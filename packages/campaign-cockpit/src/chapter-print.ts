import type { PrismaClient, WikiPageNode } from "@uwe/database/server";
import {
  DUNGEON_PREP_STATUS_LABELS,
  formatInGameDate,
  parseInGameDate,
  parseWorldCalendarMonths,
  renderPageContentHtml,
} from "@uwe/database/server";
import { stripDmSections } from "@uwe/auth";
import type { WorldWikiGraph } from "@uwe/database/page-service";
import { STORY_ARC_TYPE } from "./cockpit-service";
import { deriveQuestRelations } from "./quest-relations";

/*
 * Kapitel-Druck: „Papier am Spieltisch". Zwei Varianten:
 *  - dm      → druckt :::dm-Bereiche mit (als gestrichelter Kasten) und DM-Texte
 *  - spieler → DM-Bereiche werden VOR dem Rendern aus dem Rohtext geschnitten
 *              (stripDmSections) — für Ausdrucke, die am Tisch herumgereicht werden.
 *
 * Muster: Charakterbogen-Druck (character-sheet-export.ts) — eigenständiges
 * HTML-Dokument mit A4-Druckstilen, dazu ein Markdown-Export aus dem Rohtext.
 */

export type ChapterPrintVariant = "dm" | "spieler";

const QUEST_STATUS_PRINT_LABELS: Record<string, string> = {
  open: "Offen",
  completed: "Erledigt",
  failed: "Gescheitert",
};

export interface ChapterPrintQuest {
  title: string;
  statusLabel: string;
  html: string;
  raw: string;
  npcs: string[];
  locations: string[];
  factions: string[];
  events: Array<{ title: string; roleLabel: string }>;
}

export interface ChapterPrintData {
  variant: ChapterPrintVariant;
  worldName: string;
  campaignName: string;
  chapterTitle: string;
  chapterSummary: string | null;
  statusLabel: string;
  dateLine: string | null;
  html: string;
  raw: string;
  quests: ChapterPrintQuest[];
}

const EVENT_ROLE_PRINT_LABELS: Record<string, string> = {
  primary: "Hauptakteur",
  involved: "Beteiligt",
  location: "Ort",
  faction: "Fraktion",
  trigger: "Auslöser",
  consequence: "Folge",
};

type BlocksPage<T> = T & { contentBlocks: Array<{ content: string } & Record<string, unknown>> };

/** DM-Bereiche blockweise aus dem Rohtext schneiden (Spieler-Variante). */
function stripPageForPlayers<T>(page: BlocksPage<T>): BlocksPage<T> {
  return {
    ...page,
    contentBlocks: page.contentBlocks.map((block) => ({
      ...block,
      content: stripDmSections(block.content),
    })),
  };
}

function combineRaw(page: { contentBlocks: Array<{ content: string }> }): string {
  return page.contentBlocks
    .map((block) => block.content)
    .filter(Boolean)
    .join("\n\n");
}

/** Lädt Kapitel + Quests und bereitet beide Varianten druckfertig auf. */
export async function getChapterPrintData(
  db: PrismaClient,
  worldSlug: string,
  kapitelId: string,
  options: { variant: ChapterPrintVariant; wikiIndex: WikiPageNode[]; graph: WorldWikiGraph | null },
): Promise<ChapterPrintData | null> {
  const world = await db.world.findUnique({ where: { slug: worldSlug } });
  if (!world) return null;

  const chapterRecord = await db.page.findFirst({
    where: { id: kapitelId, worldId: world.id, type: STORY_ARC_TYPE },
    include: { contentBlocks: { orderBy: { sortOrder: "asc" } }, campaign: true },
  });
  if (!chapterRecord || !chapterRecord.campaign) return null;

  const questRecords = await db.page.findMany({
    where: { worldId: world.id, parentPageId: chapterRecord.id, type: "quest" },
    include: { contentBlocks: { orderBy: { sortOrder: "asc" } }, campaign: true },
    orderBy: { title: "asc" },
  });

  const questIds = questRecords.map((quest) => quest.id);
  const eventLinks = questIds.length
    ? await db.worldEventEntityLink.findMany({
        where: { pageId: { in: questIds }, event: { worldId: world.id } },
        include: { event: { select: { title: true } } },
      })
    : [];

  const calendar = await db.worldCalendar.findUnique({
    where: { worldId: world.id },
    select: { currentDate: true, months: true },
  });
  const months = parseWorldCalendarMonths(calendar?.months);
  const dateLine = calendar?.currentDate
    ? formatInGameDate(parseInGameDate(calendar.currentDate), months)
    : null;

  const playerVariant = options.variant === "spieler";
  const chapter = playerVariant ? stripPageForPlayers(chapterRecord) : chapterRecord;

  const quests: ChapterPrintQuest[] = questRecords.map((questRecord) => {
    const quest = playerVariant ? stripPageForPlayers(questRecord) : questRecord;
    // Beziehungen aus dem VOLLEN Text ableiten wäre ein Leak in der
    // Spieler-Variante — deshalb aus dem bereits geschnittenen Rohtext nur
    // dann, wenn der Graph die Blöcke kennt (Graph arbeitet blockweise auf dem
    // Original; in der Spieler-Variante lassen wir die Beziehungen weg).
    const relations =
      options.graph && !playerVariant
        ? deriveQuestRelations(worldSlug, questRecord, options.graph)
        : { npcs: [], locations: [], factions: [] };
    return {
      title: quest.title,
      statusLabel: QUEST_STATUS_PRINT_LABELS[questRecord.questStatus ?? "open"] ?? "Offen",
      html: renderPageContentHtml(quest, options.wikiIndex),
      raw: combineRaw(quest),
      npcs: relations.npcs.map((target) => target.title),
      locations: relations.locations.map((target) => target.title),
      factions: relations.factions.map((target) => target.title),
      events: playerVariant
        ? []
        : eventLinks
            .filter((link) => link.pageId === questRecord.id)
            .map((link) => ({
              title: link.event.title,
              roleLabel: EVENT_ROLE_PRINT_LABELS[link.role] ?? link.role,
            })),
    };
  });

  return {
    variant: options.variant,
    worldName: world.name,
    campaignName: chapterRecord.campaign.name,
    chapterTitle: chapterRecord.title,
    chapterSummary: chapterRecord.summary,
    statusLabel: chapterRecord.prepStatus
      ? DUNGEON_PREP_STATUS_LABELS[chapterRecord.prepStatus]
      : "—",
    dateLine,
    html: renderPageContentHtml(chapter, options.wikiIndex),
    raw: combineRaw(playerVariant ? stripPageForPlayers(chapterRecord) : chapterRecord),
    quests,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printStyles(): string {
  return `
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: #111; background: #fff;
      font-size: 11pt; line-height: 1.4;
    }
    .kp-sheet { max-width: 760px; margin: 0 auto; padding: 1rem; }
    .kp-header { border-bottom: 2px solid #111; margin-bottom: 1rem; padding-bottom: 0.5rem; }
    .kp-header h1 { margin: 0 0 0.2rem; font-size: 1.5rem; }
    .kp-meta { color: #555; font-size: 0.9rem; margin: 0; }
    .kp-section { margin: 1.25rem 0; break-inside: avoid; }
    .kp-section h2 { font-size: 1.1rem; margin: 0 0 0.5rem; border-bottom: 1px solid #ccc; padding-bottom: 0.2rem; }
    .kp-quest { margin: 1rem 0; padding: 0 0 0.5rem; break-inside: avoid; }
    .kp-quest h3 { font-size: 1rem; margin: 0 0 0.3rem; }
    .kp-quest-status { font-size: 0.85rem; color: #555; }
    .kp-relations { font-size: 0.9rem; color: #444; margin: 0.3rem 0; }
    .kp-muted { color: #666; font-size: 0.9rem; }
    .kp-toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .kp-toolbar button {
      font: inherit; padding: 0.35rem 0.75rem; border: 1px solid #333;
      background: #fff; color: #111; cursor: pointer; border-radius: 4px;
    }
    .wiki-content img { max-width: 100%; height: auto; }
    .wiki-content a { color: inherit; }
    /* Am Tisch wird der Ausdruck herumgereicht: DM-Kästen bleiben auf Papier
       als gestrichelter Rahmen erkennbar (gleiche Regel wie wiki.css). */
    .wiki-dm-section { border: 1px dashed #000; padding: 0.5rem 0.75rem; margin: 0.75rem 0; }
    .wiki-dm-section::before { content: "Nur für die Spielleitung"; display: block; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; color: #555; margin-bottom: 0.3rem; }
    @media print {
      .kp-toolbar { display: none !important; }
      .kp-sheet { padding: 0; max-width: none; }
    }
  `;
}

export function buildChapterPrintHtml(data: ChapterPrintData): string {
  const questSections = data.quests
    .map((quest) => {
      const relationBits: string[] = [];
      if (quest.npcs.length) relationBits.push(`NSCs: ${quest.npcs.map(escapeHtml).join(", ")}`);
      if (quest.locations.length)
        relationBits.push(`Orte: ${quest.locations.map(escapeHtml).join(", ")}`);
      if (quest.factions.length)
        relationBits.push(`Fraktionen: ${quest.factions.map(escapeHtml).join(", ")}`);
      if (quest.events.length)
        relationBits.push(
          `Chronik: ${quest.events
            .map((event) => `${escapeHtml(event.title)} (${escapeHtml(event.roleLabel)})`)
            .join(", ")}`,
        );
      return `
        <article class="kp-quest">
          <h3>${escapeHtml(quest.title)} <span class="kp-quest-status">· ${escapeHtml(quest.statusLabel)}</span></h3>
          ${relationBits.length ? `<p class="kp-relations">${relationBits.join(" · ")}</p>` : ""}
          <div class="wiki-content">${quest.html || '<p class="kp-muted">Kein Text.</p>'}</div>
        </article>`;
    })
    .join("\n");

  const variantLabel =
    data.variant === "spieler" ? "Spieler-Ausdruck (ohne DM-Bereiche)" : "DM-Ausdruck";

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(data.chapterTitle)} — Druck</title>
<style>${printStyles()}</style>
</head>
<body>
<div class="kp-sheet">
  <div class="kp-toolbar"><button onclick="window.print()">Drucken</button></div>
  <header class="kp-header">
    <h1>${escapeHtml(data.chapterTitle)}</h1>
    <p class="kp-meta">
      ${escapeHtml(data.campaignName)} · ${escapeHtml(data.worldName)} · Status: ${escapeHtml(data.statusLabel)}${
        data.dateLine ? ` · Weltuhr: ${escapeHtml(data.dateLine)}` : ""
      } · ${variantLabel}
    </p>
    ${data.chapterSummary ? `<p class="kp-meta">${escapeHtml(data.chapterSummary)}</p>` : ""}
  </header>
  <section class="kp-section">
    <div class="wiki-content">${data.html || '<p class="kp-muted">Kein Kapiteltext.</p>'}</div>
  </section>
  ${
    data.quests.length
      ? `<section class="kp-section"><h2>Quests</h2>${questSections}</section>`
      : ""
  }
</div>
</body>
</html>`;
}

export function buildChapterPrintMarkdown(data: ChapterPrintData): string {
  const lines: string[] = [];
  lines.push(`# ${data.chapterTitle}`);
  lines.push(
    `${data.campaignName} · ${data.worldName} · Status: ${data.statusLabel}${
      data.dateLine ? ` · Weltuhr: ${data.dateLine}` : ""
    }`,
  );
  if (data.chapterSummary) {
    lines.push("");
    lines.push(data.chapterSummary);
  }
  lines.push("");
  lines.push(data.raw);
  for (const quest of data.quests) {
    lines.push("");
    lines.push(`## Quest: ${quest.title} (${quest.statusLabel})`);
    const relationBits: string[] = [];
    if (quest.npcs.length) relationBits.push(`NSCs: ${quest.npcs.join(", ")}`);
    if (quest.locations.length) relationBits.push(`Orte: ${quest.locations.join(", ")}`);
    if (quest.factions.length) relationBits.push(`Fraktionen: ${quest.factions.join(", ")}`);
    if (relationBits.length) {
      lines.push(relationBits.join(" · "));
    }
    lines.push("");
    lines.push(quest.raw);
  }
  return `${lines.join("\n").trim()}\n`;
}
