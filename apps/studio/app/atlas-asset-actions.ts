"use server";

/**
 * RTX-Asset-Studio server actions (MVP slice).
 *
 * Two review-only steps, never auto-apply:
 *   1. generateAtlasAssetProposalAction — bounded DM prompt → runBrainAction
 *      (atlas_generate_asset_proposal, local/RTX providers only) → re-validate
 *      the model output with validateRtxAtlasAssetProposal server-side.
 *   2. saveAtlasAssetProposalAction — re-validates the proposal again (client
 *      data is never trusted) and stores it as a pending AtlasPaletteItem with
 *      the proposal JSON in styleTags. No AtlasObject, no builtin promotion;
 *      pending items never reach the Portal or the static export.
 */

import { revalidatePath } from "next/cache";
import {
  createAiRunServiceFromClient,
  createBrainStoreService,
  createAtlasService,
  createPrismaClient,
  createUweRepository,
  getAppRepository,
  getSystemSettings,
  prisma,
  resolveLocalOnlyMode,
} from "@uwe/database/server";
import {
  resolveAiBrainSettings,
  runBrainAction,
  type AiProviderId,
} from "@uwe/ai-brain";
import {
  validateRtxAtlasAssetProposal,
  type RtxAtlasAssetProposal,
  type RtxAtlasAssetProposalIssue,
} from "@uwe/atlas/rtx-asset-proposal";
import { createApiKeyStore } from "@/src/lib/ai-key-store";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { toGatewayUser } from "@/src/lib/ai-gateway-user";
import { requireStudioWorldEdit } from "@/src/lib/authz";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

/** Hard cap for the DM prompt — the styleguide context does the heavy lifting. */
const MAX_ASSET_PROMPT_LENGTH = 500;
/** Bounded model id (free text, but never unbounded client input). */
const MAX_MODEL_LENGTH = 64;
/** Upper bound for the re-submitted proposal JSON (validator caps content anyway). */
const MAX_PROPOSAL_JSON_LENGTH = 64_000;
/** How much raw model text we echo back for the error display. */
const MAX_RAW_TEXT_PREVIEW = 2_000;

/**
 * Only local/RTX providers — this slice deliberately does not route the
 * asset workflow through cloud providers (providerIdToMode → "local_rtx").
 */
const LOCAL_RTX_PROVIDERS = ["ollama", "openai_compatible"] as const satisfies readonly AiProviderId[];
const DEFAULT_ASSET_PROVIDER: AiProviderId = "ollama";
const DEFAULT_ASSET_MODEL = "gemma3:4b";

export interface AtlasAssetProposalIssueView {
  path: string;
  message: string;
}

export interface GenerateAtlasAssetProposalSuccess {
  runId: string;
  proposal: RtxAtlasAssetProposal;
  warnings: string[];
  providerUsed: string;
  error?: never;
}
export interface GenerateAtlasAssetProposalError {
  runId?: string;
  proposal?: never;
  error: string;
  issues?: AtlasAssetProposalIssueView[];
  rawText?: string;
}

function normalizeProvider(value: FormDataEntryValue | null): AiProviderId {
  if (typeof value !== "string") return DEFAULT_ASSET_PROVIDER;
  const trimmed = value.trim();
  return (LOCAL_RTX_PROVIDERS as readonly string[]).includes(trimmed)
    ? (trimmed as AiProviderId)
    : DEFAULT_ASSET_PROVIDER;
}

function normalizeModel(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return DEFAULT_ASSET_MODEL;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MODEL_LENGTH) return DEFAULT_ASSET_MODEL;
  return trimmed;
}

function toIssueViews(errors: RtxAtlasAssetProposalIssue[]): AtlasAssetProposalIssueView[] {
  return errors.slice(0, 8).map((issue) => ({ path: issue.path, message: issue.message }));
}

/** Mirror of the ai-brain proposal parser: first JSON object, fenced or bare. */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Ask the local/RTX brain for an Atlas Gouache asset proposal.
 *
 * The result is only ever returned as a validated, review-only proposal —
 * validation runs server-side here in addition to the ai-brain proposal
 * pipeline, and nothing is persisted by this action.
 */
export async function generateAtlasAssetProposalAction(
  formData: FormData,
): Promise<GenerateAtlasAssetProposalSuccess | GenerateAtlasAssetProposalError> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  await requireStudioWorldEdit(worldSlug);

  const prompt = String(formData.get("prompt") || "").trim();
  if (!prompt) {
    return { error: "Asset-Beschreibung fehlt." };
  }
  if (prompt.length > MAX_ASSET_PROMPT_LENGTH) {
    return {
      error: `Asset-Beschreibung ist zu lang (max. ${MAX_ASSET_PROMPT_LENGTH} Zeichen).`,
    };
  }

  const providerId = normalizeProvider(formData.get("providerId"));
  const model = normalizeModel(formData.get("model"));
  const useMock = process.env.AI_USE_MOCK === "true" || model === "mock-model";

  const systemSettings = await getSystemSettings();
  const apiKeyStore = await createApiKeyStore();
  const settings = resolveAiBrainSettings(apiKeyStore, {
    localOnly: resolveLocalOnlyMode(systemSettings),
    enabled: systemSettings.ai.enabled,
  });

  const user = await getCurrentAuthUser();
  const deps = {
    repo: createUweRepository(),
    aiRuns: createAiRunServiceFromClient(prisma),
    brainStore: createBrainStoreService(),
  };

  let runId: string | undefined;
  let resultText: string;
  let providerUsed: string;
  try {
    const result = await runBrainAction(deps, {
      actionId: "atlas_generate_asset_proposal",
      worldSlug,
      providerId,
      model,
      userPrompt: prompt,
      userId: user?.id,
      gatewayUser: user ? toGatewayUser(user) : undefined,
      useMock,
      apiKeyStore,
      options: {
        allowDmOnly: settings.localOnly,
        datenschutzMode: settings.datenschutzMode,
        localOnly: settings.localOnly,
      },
    });
    runId = result.runId;
    resultText = result.result.text;
    providerUsed = result.result.provider;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Asset-Proposal konnte nicht generiert werden.",
    };
  }

  // Re-validate the raw model output server-side — the final gate before the
  // proposal is shown for review or accepted by the save action.
  const validation = validateRtxAtlasAssetProposal(extractJsonObject(resultText));
  if (!validation.ok) {
    return {
      runId,
      error: "Das RTX-Ergebnis ist kein gültiges Atlas-Asset-Proposal.",
      issues: toIssueViews(validation.errors),
      rawText: resultText.slice(0, MAX_RAW_TEXT_PREVIEW),
    };
  }

  return {
    runId,
    proposal: validation.proposal,
    warnings: validation.warnings,
    providerUsed,
  };
}

export interface SaveAtlasAssetProposalSuccess {
  savedId: string;
  name: string;
  error?: never;
  issues?: never;
}
export interface SaveAtlasAssetProposalError {
  savedId?: never;
  error: string;
  issues?: AtlasAssetProposalIssueView[];
}

/**
 * Persist a re-validated RTX asset proposal as a pending AtlasPaletteItem.
 *
 * source=ai + reviewStatus=pending keeps the item out of Portal/static export;
 * the validated proposal JSON rides in styleTags (established metadata channel,
 * no migration). No AtlasObject is created and there is no builtin promotion.
 */
export async function saveAtlasAssetProposalAction(
  formData: FormData,
): Promise<SaveAtlasAssetProposalSuccess | SaveAtlasAssetProposalError> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  await requireStudioWorldEdit(worldSlug);

  const proposalJson = String(formData.get("proposal") || "");
  if (!proposalJson.trim()) {
    return { error: "Kein Proposal übermittelt." };
  }
  if (proposalJson.length > MAX_PROPOSAL_JSON_LENGTH) {
    return { error: "Proposal-JSON ist zu groß." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(proposalJson);
  } catch {
    return { error: "Proposal ist kein gültiges JSON." };
  }

  // Never trust client data: the exact same validator gates the save path.
  const validation = validateRtxAtlasAssetProposal(parsed);
  if (!validation.ok) {
    return {
      error: "Proposal wurde serverseitig verworfen.",
      issues: toIssueViews(validation.errors),
    };
  }
  const proposal = validation.proposal;

  const runIdRaw = String(formData.get("runId") || "").trim();
  const runId = /^[a-z0-9-]{1,64}$/i.test(runIdRaw) ? runIdRaw : undefined;

  const db = createPrismaClient();
  const atlas = createAtlasService(db);
  try {
    const world = await getAppRepository().getWorldBySlug(worldSlug);
    if (!world) return { error: "Welt nicht gefunden" };

    const item = await atlas.createPaletteItem({
      worldId: world.id,
      name: proposal.name,
      kind: "rtx_asset",
      source: "ai",
      reviewStatus: "pending",
      styleTags: {
        proposalKind: "atlas_asset_proposal",
        rtxAssetProposal: JSON.parse(JSON.stringify(proposal)),
        ...(runId ? { runId } : {}),
      },
    });

    revalidatePath(`/worlds/${worldSlug}/atlas`);
    return { savedId: item.id, name: item.name };
  } finally {
    await db.$disconnect();
  }
}
