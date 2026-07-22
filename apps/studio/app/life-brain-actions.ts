"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { indexPersonalBrainDocument, reindexPersonalBrain } from "@uwe/ai-brain";
import { createPersonalBrainService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { revalidatePath } from "next/cache";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

function personalBrain() {
  return createPersonalBrainService(brainPrisma);
}

export async function reindexLifeBrainAction() {
  await requireStudioActionAuth();

  const useMock = process.env.AI_USE_MOCK === "true";

  if (useMock) {
    await reindexPersonalBrain(personalBrain(), undefined, { useMock: true, force: true });
  } else {
    await enqueueAndDispatch({
      type: "embedding",
      title: "Life Brain Reindex",
      payload: {
        reindexPersonalBrain: true,
        useMock: false,
      },
    });
  }

  revalidatePath("/life-brain");
}

export async function indexLifeBrainDocumentAction(formData: FormData) {
  await requireStudioActionAuth();

  const documentId = String(formData.get("documentId") || "");
  await indexPersonalBrainDocument(personalBrain(), documentId, undefined, {
    useMock: process.env.AI_USE_MOCK === "true",
  });
  revalidatePath("/life-brain");
  revalidatePath(`/life-brain/documents/${documentId}`);
}
