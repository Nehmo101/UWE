"use server";

import { indexPersonalBrainDocument, reindexPersonalBrain } from "@uwe/ai-brain";
import { createPersonalBrainService, prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { assertStudioTrusted } from "@/src/lib/authz";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

function personalBrain() {
  return createPersonalBrainService(prisma);
}

export async function reindexLifeBrainAction() {
  assertStudioTrusted();

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
  assertStudioTrusted();

  const documentId = String(formData.get("documentId") || "");
  await indexPersonalBrainDocument(personalBrain(), documentId, undefined, {
    useMock: process.env.AI_USE_MOCK === "true",
  });
  revalidatePath("/life-brain");
}
