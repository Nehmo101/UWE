import type { AiRunService, BrainStoreService, UweRepository } from "@uwe/database/server";
import { createAiReviewService, createPrismaClient } from "@uwe/database/server";
import { markProposalStatus, parseProposals } from "./proposals";

export interface ApplyProposalInput {
  runId: string;
  proposalId: string;
  editedContent?: string;
  ideaTitle?: string;
}

export interface ApplyProposalDeps {
  repo: UweRepository;
  aiRuns: AiRunService;
  brainStore: BrainStoreService;
  databaseUrl?: string;
}

export interface ApplyProposalResult {
  runId: string;
  proposalId: string;
  appliedTarget: string;
  appliedId?: string;
  undoEntryId?: string;
  message?: string;
}

function reviewService(deps: ApplyProposalDeps) {
  return createAiReviewService(createPrismaClient(deps.databaseUrl));
}

export async function applyProposal(
  deps: ApplyProposalDeps,
  input: ApplyProposalInput,
): Promise<ApplyProposalResult> {
  const run = await deps.aiRuns.getById(input.runId);
  if (!run) {
    throw new Error("AI-Run nicht gefunden.");
  }

  if (run.status === "applied" || run.status === "discarded") {
    throw new Error(`Run ist bereits ${run.status}.`);
  }

  if (run.status !== "completed") {
    throw new Error("Nur abgeschlossene Runs können übernommen werden.");
  }

  const review = reviewService(deps);
  await review.syncJsonProposalsFromRun(input.runId, parseProposals(run.proposals));

  const result = await review.applyBrainProposal(input);
  if (!result.ok) {
    throw new Error(result.message);
  }

  const proposals = parseProposals(run.proposals);
  const proposal = proposals.find((entry) => entry.id === input.proposalId);
  const updatedProposals = markProposalStatus(proposals, input.proposalId, "applied");
  await deps.aiRuns.setProposals(run.id, updatedProposals);
  await deps.aiRuns.markApplied(run.id);

  return {
    runId: run.id,
    proposalId: input.proposalId,
    appliedTarget: result.appliedTargetType ?? proposal?.targetType ?? "unknown",
    appliedId: result.appliedTargetId,
    undoEntryId: result.undoEntryId,
    message: result.message,
  };
}

export async function discardRun(deps: ApplyProposalDeps, runId: string): Promise<void> {
  const run = await deps.aiRuns.getById(runId);
  if (!run) {
    throw new Error("AI-Run nicht gefunden.");
  }

  if (run.status === "applied") {
    throw new Error("Übernommene Runs können nicht verworfen werden.");
  }

  const review = reviewService(deps);
  await review.syncJsonProposalsFromRun(runId, parseProposals(run.proposals));
  const result = await review.discardBrainRun(runId);
  if (!result.ok) {
    throw new Error(result.message);
  }

  const proposals = parseProposals(run.proposals).map((proposal) => ({
    ...proposal,
    status: proposal.status === "applied" ? proposal.status : ("discarded" as const),
  }));

  await deps.aiRuns.setProposals(runId, proposals);
}
