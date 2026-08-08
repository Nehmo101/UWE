"use server";

import { z } from "zod";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createAuthService,
  createGameSessionService,
  createPrintListService,
  createQuestLifecycleService,
  createWorldEventService,
  getAppRepository,
  parseInGameDate,
  prisma,
  type DungeonPrepStatus,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import type { WorldEventEntityRole } from "@uwe/database/enums";
import {
  createCampaignCockpitService,
  createSessionWrapUpService,
  createStoryArcPinService,
} from "@uwe/campaign-cockpit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";

/*
 * Server Actions für das Kampagnen-Cockpit und den Radar (Muster:
 * dungeon-actions.ts). Alle Aktionen tragen explizite Slug-Felder —
 * kein Pfad-Parsing aus redirectTo.
 */

function repo() {
  return getAppRepository();
}

/**
 * Wohin nach einer Quick-Action zurückgeleitet wird. Validiertes Enum statt
 * freiem Redirect-Ziel: die Aktion bleibt in der Ansicht, aus der sie kam —
 * der alte Weg über den Quest-Editor warf den DM aus dem Radar (und landete
 * wegen der falschen Nav-Kategorie sogar auf einer 404).
 */
const returnTargetSchema = z.enum(["radar", "cockpit", "kapitel", "abschluss", "live"]);

function resolveReturnPath(
  target: z.infer<typeof returnTargetSchema>,
  worldSlug: string,
  campaignSlug: string | null,
  kapitelSlug: string | null,
  sessionId: string | null,
): string {
  const base = `/worlds/${worldSlug}`;
  switch (target) {
    case "radar":
      return `${base}/radar`;
    case "cockpit":
      return `${base}/kampagnen/${campaignSlug ?? ""}`;
    case "kapitel":
      return `${base}/kampagnen/${campaignSlug ?? ""}/kapitel/${kapitelSlug ?? ""}`;
    case "abschluss": {
      const suffix = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
      return `${base}/kampagnen/${campaignSlug ?? ""}/abschluss${suffix}`;
    }
    // Spielabend: Quest-Status direkt aus der Akt-Tafel des Live-Modus setzen.
    case "live":
      return `${base}/sessions/${sessionId ?? ""}/live`;
  }
}

function parseReturnTarget(formData: FormData) {
  const parsed = returnTargetSchema.safeParse(formData.get("returnTo") ?? "radar");
  if (!parsed.success) {
    throw new Error("Ungültiges Rücksprungziel.");
  }
  return parsed.data;
}

function appendQuery(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
}

const QUEST_STATUSES = new Set<QuestLifecycleStatus | "">(["", "open", "completed", "failed"]);

/**
 * Quest-Status setzen, ohne die Ansicht zu verlassen. Ersetzt im Radar den
 * Umweg über updateQuestStatusAction (der zum Quest-Editor redirectete).
 */
export async function updateQuestStatusInPlaceAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const rawStatus = String(formData.get("questStatus") ?? "");
  const returnTo = parseReturnTarget(formData);
  const campaignSlug = String(formData.get("campaignSlug") || "") || null;
  const kapitelSlug = String(formData.get("kapitelSlug") || "") || null;
  const sessionId = String(formData.get("sessionId") || "") || null;

  if (!QUEST_STATUSES.has(rawStatus as QuestLifecycleStatus | "")) {
    throw new Error("Ungültiger Quest-Status.");
  }

  await requireStudioContentEdit(worldSlug, pageId);

  const page = await repo().getPageById(pageId);
  if (!page || page.type !== "quest") {
    throw new Error("Quest-Status ist nur für Quest-Seiten verfügbar.");
  }
  await createQuestLifecycleService(prisma).updateQuestStatus(
    pageId,
    rawStatus === "" ? null : (rawStatus as QuestLifecycleStatus),
  );

  const returnPath = resolveReturnPath(returnTo, worldSlug, campaignSlug, kapitelSlug, sessionId);
  revalidatePath(returnPath);
  redirect(appendQuery(returnPath, "saved", "1"));
}

const titleSchema = z.string().trim().min(1, "Titel ist erforderlich.");

function parseTitle(formData: FormData): string {
  const result = titleSchema.safeParse(formData.get("title") ?? "");
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Ungültiger Titel.");
  }
  return result.data;
}

const PREP_STATUSES = new Set<DungeonPrepStatus>(["unprepared", "ready", "played", "skipped"]);

function parsePrepStatus(formData: FormData): DungeonPrepStatus {
  const value = String(formData.get("prepStatus") ?? "unprepared") as DungeonPrepStatus;
  if (!PREP_STATUSES.has(value)) {
    throw new Error("Ungültiger Kapitel-Status.");
  }
  return value;
}

async function requireCampaign(worldSlug: string, campaignSlug: string) {
  const campaign = await createCampaignCockpitService(prisma).getCampaign(
    worldSlug,
    campaignSlug,
  );
  if (!campaign) throw new Error("Kampagne nicht gefunden.");
  return campaign;
}

function cockpitPath(worldSlug: string, campaignSlug: string) {
  return `/worlds/${worldSlug}/kampagnen/${campaignSlug}`;
}

export async function createStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  await requireStudioWorldEdit(worldSlug);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  const parentChapterId = String(formData.get("parentChapterId") || "") || null;
  const chapter = await createCampaignCockpitService(prisma).createChapter({
    worldId: campaign.worldId,
    campaignId: campaign.id,
    parentChapterId,
    title: parseTitle(formData),
    summary: String(formData.get("summary") || "") || null,
    content: String(formData.get("content") || "") || undefined,
  });

  revalidatePath(cockpitPath(worldSlug, campaignSlug));
  redirect(`${cockpitPath(worldSlug, campaignSlug)}/kapitel/${chapter.slug}?created=1`);
}

export async function updateStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const kapitelSlug = String(formData.get("kapitelSlug"));
  const chapterId = String(formData.get("chapterId"));
  await requireStudioContentEdit(worldSlug, chapterId);

  await requireCampaign(worldSlug, campaignSlug);
  await createCampaignCockpitService(prisma).updateChapter(chapterId, {
    prepStatus: parsePrepStatus(formData),
    ...(formData.has("title") ? { title: parseTitle(formData) } : {}),
    ...(formData.has("summary")
      ? { summary: String(formData.get("summary") || "") || null }
      : {}),
  });

  const kapitelPath = `${cockpitPath(worldSlug, campaignSlug)}/kapitel/${kapitelSlug}`;
  revalidatePath(kapitelPath);
  revalidatePath(cockpitPath(worldSlug, campaignSlug));
  redirect(`${kapitelPath}?saved=1`);
}

export async function moveStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const chapterId = String(formData.get("chapterId"));
  const direction = String(formData.get("direction"));
  if (direction !== "up" && direction !== "down") {
    throw new Error("Ungültige Richtung.");
  }
  await requireStudioWorldEdit(worldSlug);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  await createCampaignCockpitService(prisma).moveChapter(
    campaign.worldId,
    campaign.id,
    chapterId,
    direction,
  );

  revalidatePath(cockpitPath(worldSlug, campaignSlug));
  redirect(`${cockpitPath(worldSlug, campaignSlug)}?saved=1`);
}

export async function assignQuestToArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const kapitelSlug = String(formData.get("kapitelSlug") || "") || null;
  const questId = String(formData.get("questId"));
  const chapterId = String(formData.get("chapterId") || "") || null;
  await requireStudioContentEdit(worldSlug, questId);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  await createCampaignCockpitService(prisma).assignQuestToChapter(
    campaign.worldId,
    questId,
    chapterId,
  );

  const returnPath = kapitelSlug
    ? `${cockpitPath(worldSlug, campaignSlug)}/kapitel/${kapitelSlug}`
    : cockpitPath(worldSlug, campaignSlug);
  revalidatePath(returnPath);
  redirect(`${returnPath}?saved=1`);
}

/** Dungeon einem Kapitel zuordnen/lösen — dieselbe Kante wie bei Quests. */
export async function assignDungeonToArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const kapitelSlug = String(formData.get("kapitelSlug"));
  const dungeonId = String(formData.get("dungeonId"));
  const chapterId = String(formData.get("chapterId") || "") || null;
  await requireStudioContentEdit(worldSlug, dungeonId);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  await createCampaignCockpitService(prisma).assignDungeonToChapter(
    campaign.worldId,
    dungeonId,
    chapterId,
  );

  const kapitelPath = `${cockpitPath(worldSlug, campaignSlug)}/kapitel/${kapitelSlug}`;
  revalidatePath(kapitelPath);
  revalidatePath(cockpitPath(worldSlug, campaignSlug));
  redirect(`${kapitelPath}?saved=1#kapitel-dungeons`);
}

/**
 * Seite an ein Kapitel pinnen (Akt-Tafel). Die Rolle leitet der Service aus
 * dem Seitentyp ab; erlaubt sind NSC-, Orts-, Fraktions- und Handout-Seiten.
 */
export async function pinPageToStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const kapitelSlug = String(formData.get("kapitelSlug"));
  const chapterId = String(formData.get("chapterId"));
  const pageId = String(formData.get("pageId"));
  await requireStudioContentEdit(worldSlug, chapterId);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  await createStoryArcPinService(prisma).pin(campaign.worldId, chapterId, pageId);

  const kapitelPath = `${cockpitPath(worldSlug, campaignSlug)}/kapitel/${kapitelSlug}`;
  revalidatePath(kapitelPath);
  redirect(`${kapitelPath}?saved=1#kapitel-akt-tafel`);
}

export async function unpinPageFromStoryArcAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const kapitelSlug = String(formData.get("kapitelSlug"));
  const linkId = String(formData.get("linkId"));
  await requireStudioWorldEdit(worldSlug);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  await createStoryArcPinService(prisma).unpin(campaign.worldId, linkId);

  const kapitelPath = `${cockpitPath(worldSlug, campaignSlug)}/kapitel/${kapitelSlug}`;
  revalidatePath(kapitelPath);
  redirect(`${kapitelPath}?saved=1#kapitel-akt-tafel`);
}

/* ── Session-Abschluss-Flow ─────────────────────────────────────────────── */

function abschlussPath(worldSlug: string, campaignSlug: string, sessionId: string) {
  return `${cockpitPath(worldSlug, campaignSlug)}/abschluss?session=${encodeURIComponent(sessionId)}`;
}

/**
 * Die Session muss zur Kampagne gehören — sonst könnte ein präparierter
 * sessionId-Wert Notizen einer fremden Kampagne in den Flow ziehen.
 */
async function requireWrapUpSession(
  worldSlug: string,
  campaignSlug: string,
  sessionId: string,
) {
  const wrapUp = await createSessionWrapUpService(prisma).getSessionWrapUp(
    worldSlug,
    campaignSlug,
    sessionId,
  );
  if (!wrapUp?.session) throw new Error("Session nicht gefunden.");
  return wrapUp;
}

function parseEventDate(formData: FormData) {
  const year = Number(formData.get("eventYear"));
  const month = Number(formData.get("eventMonth"));
  const day = Number(formData.get("eventDay"));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error("Weltzeit-Datum ist ungültig.");
  }
  return parseInGameDate({ year: Math.floor(year), month: Math.floor(month), day: Math.floor(day) });
}

const EVENT_LINK_ROLES = new Set<WorldEventEntityRole>(["trigger", "consequence", "involved", "faction"]);

/** Ereignis aus dem Abschluss-Flow in die Chronik, optional mit Verknüpfungen. */
export async function createEventFromWrapUpAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const sessionId = String(formData.get("sessionId"));
  await requireStudioWorldEdit(worldSlug);
  const wrapUp = await requireWrapUpSession(worldSlug, campaignSlug, sessionId);

  const title = parseTitle(formData);
  const linkedPages: Array<{ pageId: string; role: WorldEventEntityRole }> = [];
  const questId = String(formData.get("questPageId") || "");
  if (questId) {
    const questRole = String(formData.get("questRole") || "involved") as WorldEventEntityRole;
    if (!EVENT_LINK_ROLES.has(questRole)) throw new Error("Ungültige Verknüpfungs-Rolle.");
    linkedPages.push({ pageId: questId, role: questRole });
  }
  const factionId = String(formData.get("factionPageId") || "");
  if (factionId) {
    linkedPages.push({ pageId: factionId, role: "faction" });
  }

  await createWorldEventService(prisma).create({
    worldId: wrapUp.worldId,
    gameSessionId: sessionId,
    inGameDate: parseEventDate(formData),
    title,
    summaryPlayer: String(formData.get("summaryPlayer") || "") || null,
    summaryDm: String(formData.get("summaryDm") || "") || null,
    sourceType: "manual",
    linkedPages,
  });

  const path = abschlussPath(worldSlug, campaignSlug, sessionId);
  revalidatePath(`/worlds/${worldSlug}/chronicle`);
  revalidatePath(path);
  redirect(`${path}&event=1#schritt-ereignisse`);
}

/** Geteilte Spielernotiz als Chronik-Ereignis übernehmen; Notiz wird accepted. */
export async function adoptNoteAsEventAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const sessionId = String(formData.get("sessionId"));
  const noteId = String(formData.get("noteId"));
  await requireStudioWorldEdit(worldSlug);
  const wrapUp = await requireWrapUpSession(worldSlug, campaignSlug, sessionId);

  // Nur Notizen aus der Review-Liste dieser Session — nie private/fremde.
  const note = wrapUp.sharedNotes.find((candidate) => candidate.id === noteId);
  if (!note) throw new Error("Notiz nicht gefunden.");

  const firstLine = note.content.split("\n")[0]?.trim() ?? "";
  const title =
    String(formData.get("title") || "").trim() ||
    (firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine) ||
    "Spielernotiz";

  await createWorldEventService(prisma).create({
    worldId: wrapUp.worldId,
    gameSessionId: sessionId,
    inGameDate: wrapUp.clock.current ?? parseInGameDate(null),
    title,
    summaryDm: note.content,
    sourceType: "manual",
  });
  await createAuthService(prisma).getPlayerNoteService().accept(noteId);

  const path = abschlussPath(worldSlug, campaignSlug, sessionId);
  revalidatePath(`/worlds/${worldSlug}/chronicle`);
  revalidatePath(path);
  redirect(`${path}&note=1#schritt-notizen`);
}

/** Geteilte Spielernotiz an eine Quest hängen (ContentBlock); Notiz wird accepted. */
export async function attachNoteToQuestAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const sessionId = String(formData.get("sessionId"));
  const noteId = String(formData.get("noteId"));
  const questPageId = String(formData.get("questPageId"));
  await requireStudioContentEdit(worldSlug, questPageId);
  const wrapUp = await requireWrapUpSession(worldSlug, campaignSlug, sessionId);

  const note = wrapUp.sharedNotes.find((candidate) => candidate.id === noteId);
  if (!note) throw new Error("Notiz nicht gefunden.");
  if (!wrapUp.openQuests.some((quest) => quest.id === questPageId)) {
    throw new Error("Quest nicht gefunden.");
  }

  await createAuthService(prisma).getPlayerNoteService().adoptAsContentBlock(noteId, questPageId);

  const path = abschlussPath(worldSlug, campaignSlug, sessionId);
  revalidatePath(path);
  redirect(`${path}&note=1#schritt-notizen`);
}

/** Notiz aus der Review-Liste ausblenden (hidden) — nichts wird übernommen. */
export async function ignoreNoteInWrapUpAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const sessionId = String(formData.get("sessionId"));
  const noteId = String(formData.get("noteId"));
  await requireStudioWorldEdit(worldSlug);
  const wrapUp = await requireWrapUpSession(worldSlug, campaignSlug, sessionId);

  const note = wrapUp.sharedNotes.find((candidate) => candidate.id === noteId);
  if (!note) throw new Error("Notiz nicht gefunden.");

  await createAuthService(prisma).getPlayerNoteService().hide(noteId);

  const path = abschlussPath(worldSlug, campaignSlug, sessionId);
  revalidatePath(path);
  redirect(`${path}&note=1#schritt-notizen`);
}

/**
 * Brücke zur Handout-Pipeline: Kapitel + zugehörige Quest-Seiten als
 * Druckliste ins Print-Center (analog preparePrintListFromSessionAction).
 */
export async function preparePrintListFromChapterAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const chapterId = String(formData.get("chapterId"));
  await requireStudioWorldEdit(worldSlug);

  const campaign = await requireCampaign(worldSlug, campaignSlug);
  const chapter = await prisma.page.findFirst({
    where: { id: chapterId, worldId: campaign.worldId, type: "story_arc" },
    select: { id: true, title: true },
  });
  if (!chapter) throw new Error("Kapitel nicht gefunden.");

  const quests = await prisma.page.findMany({
    where: { worldId: campaign.worldId, parentPageId: chapter.id, type: "quest" },
    select: { id: true },
  });

  const list = await createPrintListService().createFromPageIds(
    campaign.worldId,
    `Kapitel: ${chapter.title}`,
    [chapter.id, ...quests.map((quest) => quest.id)],
    { forNextSession: formData.get("forNextSession") === "on" },
  );

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${list.id}?created=1`);
}

/** Session als ausgewertet markieren (Status summarized). */
export async function markSessionWrappedAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const campaignSlug = String(formData.get("campaignSlug"));
  const sessionId = String(formData.get("sessionId"));
  await requireStudioWorldEdit(worldSlug);
  await requireWrapUpSession(worldSlug, campaignSlug, sessionId);

  await createGameSessionService().update(sessionId, { status: "summarized" });

  const path = cockpitPath(worldSlug, campaignSlug);
  revalidatePath(path);
  revalidatePath(`/worlds/${worldSlug}/sessions`);
  redirect(`${path}?saved=1`);
}
