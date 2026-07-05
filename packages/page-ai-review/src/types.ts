import type { AiTaskType } from "@uwe/ai-brain";
import type { PublishStatus } from "@uwe/database/enums";

export type PageAiReviewAction = "format" | "tags" | "convert";

export interface PageAiReviewJobPayload {
  pageReview?: boolean;
  pageReviewAction?: PageAiReviewAction;
  originalContent?: string;
  previousPublishStatus?: PublishStatus;
  parentProposalId?: string;
}

export interface StartBulkReviewInput {
  worldSlug: string;
  pageIds: string[];
  action: PageAiReviewAction;
  providerId: string;
  model: string;
  userPrompt?: string;
  userId?: string | null;
}

export interface StartBulkReviewResult {
  ok: boolean;
  message: string;
  jobIds: string[];
}

export interface PageReviewListItem {
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  pageType: string;
  proposalId: string;
  taskType: string;
  updatedAt: string;
  href: string;
}

export interface PageReviewChatEntry {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface PageReviewDetail {
  pageId: string;
  pageTitle: string;
  pageSlug: string;
  pageType: string;
  proposalId: string;
  taskType: string;
  originalContent: string;
  proposedContent: string;
  editedContent: string;
  suggestedTags: string[];
  suggestedMode: "replace_content";
  chatHistory: PageReviewChatEntry[];
  previousPublishStatus: PublishStatus;
}

export function resolveReviewTaskType(action: PageAiReviewAction): AiTaskType {
  switch (action) {
    case "tags":
      return "suggest_page_tags";
    case "convert":
      return "page_ai_convert";
    default:
      return "improve_lore_text";
  }
}

export function parseSuggestedTags(resultText: string): string[] {
  const trimmed = resultText.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as { tags?: unknown };
    if (Array.isArray(parsed.tags)) {
      return parsed.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
    }
  } catch {
    // fall through to comma-separated parsing
  }

  return trimmed
    .split(/[\n,;]+/)
    .map((tag) => tag.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}
