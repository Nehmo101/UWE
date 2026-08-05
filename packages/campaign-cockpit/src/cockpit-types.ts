import type {
  DbCampaign as Campaign,
  DungeonPrepStatus,
  QuestLifecycleStatus,
} from "@uwe/database/server";
import type { InGameDate } from "@uwe/database/server";
import type { ChapterProgress } from "./chapter-helpers";
import type { QuestRelations, QuestRelationTarget } from "./quest-relations";

/*
 * View-Typen des Kampagnen-Cockpits — aus cockpit-service.ts herausgezogen
 * (Modul-Disziplin: Datei-Budget), reine Typdefinitionen ohne Verhalten.
 * Bestandsimporte laufen unverändert über die Re-Exports in cockpit-service.
 */

export interface ChapterSummary {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  prepStatus: DungeonPrepStatus | null;
  sortIndex: number | null;
  href: string;
  questCounts: { open: number; completed: number; failed: number; total: number };
}

export interface CockpitQuest {
  id: string;
  title: string;
  slug: string;
  href: string;
  status: QuestLifecycleStatus;
  chapterId: string | null;
}

export interface CockpitFaction {
  pageId: string;
  title: string;
  href: string;
  agenda: string;
  powerLevel: number | null;
}

export interface CockpitSessionRef {
  id: string;
  title: string;
  sessionNumber: number;
  date: Date | null;
  status: string;
  href: string;
}

export interface CockpitEvent {
  id: string;
  title: string;
  summary: string;
  inGameDate: InGameDate;
  dateLabel: string;
}

/** Dungeon dieser Kampagne — vom aufgelösten Kampagnen-Radar hierher gezogen. */
export interface CockpitDungeon {
  id: string;
  title: string;
  slug: string;
  href: string;
  summary: string | null;
  prepStatus: DungeonPrepStatus | null;
}

export interface CampaignOverview {
  campaign: Campaign;
  worldId: string;
  chapters: ChapterSummary[];
  unassignedQuests: CockpitQuest[];
  factions: CockpitFaction[];
  lastSession: CockpitSessionRef | null;
  nextSession: CockpitSessionRef | null;
  recentEvents: CockpitEvent[];
  noteQueueCount: number;
  canonConflicts: number;
  progress: ChapterProgress;
  dungeons: CockpitDungeon[];
  npcSummary: { total: number; flagged: number };
}

export interface ChapterQuest extends CockpitQuest {
  relations: QuestRelations;
  linkedEvents: Array<{ eventId: string; title: string; role: string; roleLabel: string }>;
}

export interface ChapterView {
  campaign: Campaign;
  chapter: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    prepStatus: DungeonPrepStatus | null;
    sortIndex: number | null;
  };
  html: string;
  quests: ChapterQuest[];
  backlinks: QuestRelationTarget[];
  /** Kampagnen-Quests außerhalb dieses Kapitels — fürs „Quest zuordnen"-Select. */
  assignableQuests: Array<{ id: string; title: string }>;
  /**
   * NSC-Tafel des ganzen Akts: explizit gepinnte Seiten zuerst, dann
   * [[Wiki-Links]] aus dem Kapiteltext selbst plus alle Quest-Texte,
   * dedupliziert. Der Kapiteltext zählte früher nicht mit — wer den
   * Bösewicht nur im Akt-Text erwähnte, sah ihn nirgends.
   */
  actRelations: QuestRelations;
  /** Explizit gepinnte Seiten (StoryArcEntityLink) — für die Pin-Verwaltung. */
  pins: Array<{ id: string; role: string; target: QuestRelationTarget }>;
  /** Dungeons, die per parentPageId an diesem Kapitel hängen. */
  dungeons: CockpitDungeon[];
  /** Welt-Dungeons außerhalb dieses Kapitels — fürs „Dungeon zuordnen"-Select. */
  assignableDungeons: Array<{ id: string; title: string }>;
}

export interface CampaignCockpitSummary {
  campaignId: string;
  progress: ChapterProgress;
  openQuests: number;
  lastSession: { sessionNumber: number; title: string } | null;
}
