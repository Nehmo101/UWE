import { executeAiGatewayRequest } from "@uwe/ai-brain";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createBrainStoreService,
  createLifeAdminService,
  createUweRepository,
  prisma,
  type PrismaClient,
} from "@uwe/database/server";
import { resolveSearxngUrl, searchSearxng, type WebSearchResult } from "@uwe/web-search";
import {
  buildMorningBriefingPrompt,
  type MorningBriefingFacts,
} from "./morning-briefing-prompt";
import { loadStudioPersonalBrainPromptContext } from "./personal-brain-ai-context";
import { getTodayDashboardData } from "./today-dashboard";

export const MORNING_BRIEFING_TAG = "morning-briefing";

const DATE_LABEL = new Intl.DateTimeFormat("de-DE", { dateStyle: "full" });
const TIME_LABEL = new Intl.DateTimeFormat("de-DE", { timeStyle: "short" });
const DAY_LABEL = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function briefingTitle(now: Date): string {
  return `Morning Briefing ${now.toISOString().slice(0, 10)}`;
}

async function fetchNewsHeadlines(): Promise<WebSearchResult[]> {
  const searxngUrl = resolveSearxngUrl();
  if (!searxngUrl) {
    return [];
  }
  const query =
    process.env.UWE_BRIEFING_NEWS_QUERY?.trim() || "aktuelle Nachrichten Deutschland";
  try {
    return await searchSearxng({
      baseUrl: searxngUrl,
      query,
      limit: 6,
      categories: "news",
      timeRange: "day",
    });
  } catch {
    return [];
  }
}

export async function collectMorningBriefingFacts(
  db: PrismaClient,
  now: Date,
): Promise<MorningBriefingFacts> {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const [data, news] = await Promise.all([
    getTodayDashboardData(db, { useMockInference }),
    fetchNewsHeadlines(),
  ]);

  return {
    dateLabel: DATE_LABEL.format(now),
    calendarToday: data.calendarToday.map((item) => ({
      title: item.title,
      time: item.allDay ? null : TIME_LABEL.format(item.startAt),
      module: item.moduleLabel,
    })),
    calendarThisWeek: data.calendarThisWeek.slice(0, 8).map((item) => ({
      title: item.title,
      date: DAY_LABEL.format(item.startAt),
    })),
    nextSession: data.nextSession
      ? {
          title: data.nextSession.title,
          date: data.nextSession.date ? DAY_LABEL.format(data.nextSession.date) : null,
        }
      : null,
    mail: {
      recentFailed: data.mailSummary.recentFailed,
      pendingCount: data.mailSummary.pendingCount,
    },
    contracts: {
      alerts: data.lifeAdmin.contractAlerts.slice(0, 6).map((alert) => alert.message),
      needingReview: data.lifeAdmin.contractsNeedingReview,
    },
    prioritizedMail: {
      urgentCount: data.prioritizedMail.urgentCount,
      replyNeededCount: data.prioritizedMail.replyNeededCount,
      todayCount: data.prioritizedMail.todayCount,
      topSubjects: data.prioritizedMail.topMessages
        .map((message) => message.subject || "(ohne Betreff)")
        .slice(0, 5),
    },
    household: {
      overdueCount: data.household.overdueCount,
      soonCount: data.household.soonCount,
      overdueTitles: data.household.upcoming
        .filter((task) => task.overdue)
        .map((task) => task.title)
        .slice(0, 6),
      expiringPantryCount: data.household.expiringPantry.length,
    },
    inboxCaptureCount: data.lifeAdmin.inboxCaptureCount,
    workshopOpenTasks: data.lifeAdmin.workshopOpenTasks
      .slice(0, 6)
      .map((task) => task.title),
    hardwareIssues: data.lifeAdmin.hardwareIssues,
    systemOk: data.systemOk,
    news: news.map((item) => ({ title: item.title, snippet: item.snippet })),
  };
}

export interface MorningBriefingResult {
  documentId: string;
  title: string;
  text: string;
  newsCount: number;
}

/**
 * Generates the Morning Briefing (dashboard facts + news headlines → local LLM)
 * and stores it as a Life-Brain document — one document per day, regenerating
 * replaces the same day's briefing.
 */
export async function generateMorningBriefing(
  db: PrismaClient,
  user: { userId: string; role: string },
): Promise<MorningBriefingResult> {
  const now = new Date();
  const facts = await collectMorningBriefingFacts(db, now);
  const userPrompt = buildMorningBriefingPrompt(facts);

  const routed = await executeAiGatewayRequest(
    {
      repo: createUweRepository(),
      brainStore: createBrainStoreService(),
      loadPersonalBrainContext: () =>
        loadStudioPersonalBrainPromptContext(prisma, { retrievalLimit: 4 }),
    },
    {
      user,
      providerMode: "auto",
      contextMode: "personal_brain",
      taskType: "generate_briefing",
      userPrompt,
      useMock: process.env.AI_USE_MOCK === "true",
      feature: "AI_KNOWLEDGE_USE",
    },
  );

  const text = routed.result.text.trim();
  const title = briefingTitle(now);
  const lifeAdmin = createLifeAdminService(brainPrisma, db);

  const existing = (await lifeAdmin.listPersonalBrainDocuments({ limit: 10 })).find(
    (doc) => doc.title === title,
  );

  const metadata = {
    source: "morning_briefing",
    generatedAt: now.toISOString(),
    newsCount: facts.news.length,
    model: routed.result.model,
  };

  const document = existing
    ? await lifeAdmin.updatePersonalBrainDocument(existing.id, {
        content: text,
        metadata,
      })
    : await lifeAdmin.createPersonalBrainDocument({
        title,
        content: text,
        category: "personal_notes",
        tags: [MORNING_BRIEFING_TAG],
        metadata,
      });

  return {
    documentId: document.id,
    title,
    text,
    newsCount: facts.news.length,
  };
}
