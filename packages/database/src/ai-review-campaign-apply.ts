import { slugifyDe } from "@uwe/shared-utils";
import type { PrismaClient } from "./client";
import type { UndoService } from "./undo-service";

/*
 * Apply-Logik der beiden Kampagnen-Cockpit-Proposals — eigene Datei, weil
 * ai-review-service.ts ein eingefrorener Bestands-Monolith ist (Baseline).
 *
 * `campaign_chapter_page` legt eine NEUE story_arc-Seite an. Das ist ein
 * bewusster Spiegel von CampaignCockpitService.createChapter
 * (packages/campaign-cockpit/src/cockpit-service.ts) — @uwe/database darf
 * nicht von @uwe/campaign-cockpit abhängen (Zirkularität), also leben hier
 * dieselben drei Zutaten: Slug-Kollisionsschleife, sortIndex max+1,
 * prepStatus unprepared. Wer dort etwas ändert, zieht hier nach.
 */

export type CampaignApplyOutcome =
  | {
      ok: true;
      content: string;
      undoEntryId: string;
      appliedTargetType: "page" | "game_session";
      appliedTargetId: string;
      summary: string;
      targetHref?: string;
    }
  | { ok: false; message: string };

/** Erste `# `-Überschrift wird Seitentitel; sie fliegt aus dem Seitentext. */
export function splitChapterTitle(content: string): { title: string | null; body: string } {
  // Bewusst [ \t] statt \s und ohne \s*$-Suffix: \s würde den Zeilenumbruch
  // nach dem # schlucken, und `(.+)\s*$` backtrackt polynomiell (CodeQL js/
  // polynomial-redos). Getrimmt wird die Capture ohnehin darunter.
  const match = content.match(/^#[ \t]+(.+)$/m);
  if (!match || typeof match.index !== "number") {
    return { title: null, body: content.trim() };
  }
  const title = match[1]?.trim() || null;
  const body = (
    content.slice(0, match.index) + content.slice(match.index + match[0].length)
  ).trim();
  return { title, body };
}

async function requireCampaign(db: PrismaClient, campaignId: string | null, worldId: string) {
  if (!campaignId) return null;
  return db.campaign.findFirst({ where: { id: campaignId, worldId } });
}

export async function applyCampaignChapterProposal(
  db: PrismaClient,
  undo: UndoService,
  args: {
    worldId: string;
    worldSlug: string | null;
    campaignId: string | null;
    content: string;
    fallbackTitle?: string | null;
  },
): Promise<CampaignApplyOutcome> {
  const campaign = await requireCampaign(db, args.campaignId, args.worldId);
  if (!campaign) {
    return { ok: false, message: "Kampagne für diesen Kapitel-Entwurf nicht gefunden." };
  }

  const { title: headingTitle, body } = splitChapterTitle(args.content);
  const title = headingTitle ?? args.fallbackTitle?.trim() ?? "KI-Kapitelentwurf";
  const content = body || args.content.trim();
  if (!content) {
    return { ok: false, message: "Kein Inhalt zum Übernehmen." };
  }

  const baseSlug = slugifyDe(title) || "ki-kapitelentwurf";
  let slug = baseSlug;
  let suffix = 2;
  while (
    await db.page.findFirst({ where: { worldId: args.worldId, slug }, select: { id: true } })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const maxSortIndex = await db.page.aggregate({
    where: { worldId: args.worldId, campaignId: campaign.id, type: "story_arc" },
    _max: { sortIndex: true },
  });

  const chapter = await db.page.create({
    data: {
      worldId: args.worldId,
      campaignId: campaign.id,
      title,
      slug,
      type: "story_arc",
      prepStatus: "unprepared",
      sortIndex: (maxSortIndex._max.sortIndex ?? 0) + 1,
      contentBlocks: {
        create: [{ type: "rich_text", sortOrder: 0, content }],
      },
    },
    select: { id: true, slug: true, title: true },
  });

  const undoEntry = await undo.captureAiPageCreate(chapter.id, args.worldId);

  return {
    ok: true,
    content,
    undoEntryId: undoEntry.id,
    appliedTargetType: "page",
    appliedTargetId: chapter.id,
    summary: `KI-Kapitelentwurf als unvorbereitetes Kapitel „${chapter.title}“ übernommen.`,
    targetHref: args.worldSlug
      ? `/worlds/${args.worldSlug}/kampagnen/${campaign.slug}/kapitel/${chapter.slug}`
      : undefined,
  };
}

export async function applySessionOpenPlotsProposal(
  db: PrismaClient,
  undo: UndoService,
  args: {
    worldId: string;
    campaignId: string | null;
    content: string;
  },
): Promise<CampaignApplyOutcome> {
  const campaign = await requireCampaign(db, args.campaignId, args.worldId);
  if (!campaign) {
    return { ok: false, message: "Kampagne für diese Session-Aufhänger nicht gefunden." };
  }

  const content = args.content.trim();
  if (!content) {
    return { ok: false, message: "Kein Inhalt zum Übernehmen." };
  }

  // Die Ziel-Session wird bewusst erst JETZT aufgelöst — zwischen Lauf und
  // Review kann Zeit vergehen, und die „nächste geplante Session" wandert.
  const session = await db.gameSession.findFirst({
    where: {
      worldId: args.worldId,
      campaignId: campaign.id,
      status: { in: ["planned", "prepared"] },
    },
    orderBy: [{ sessionNumber: "asc" }],
    select: { id: true, title: true, sessionNumber: true, openPlots: true },
  });
  if (!session) {
    return {
      ok: false,
      message:
        "Keine geplante Session in dieser Kampagne — lege zuerst eine Session mit Status „geplant“ an. Der Vorschlag bleibt zum Kopieren erhalten.",
    };
  }

  const undoEntry = await undo.captureSessionOpenPlots(session.id);
  const existing = session.openPlots?.trim();
  await db.gameSession.update({
    where: { id: session.id },
    data: { openPlots: existing ? `${existing}\n\n${content}` : content },
  });

  return {
    ok: true,
    content,
    undoEntryId: undoEntry.id,
    appliedTargetType: "game_session",
    appliedTargetId: session.id,
    summary: `Session-Aufhänger zu den offenen Plots von Session ${session.sessionNumber} „${session.title}“ hinzugefügt.`,
  };
}
