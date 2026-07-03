"use server";

import { revalidatePath } from "next/cache";
import { assertStudioTrusted } from "@/src/lib/authz";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

export async function generateMorningBriefingAction() {
  assertStudioTrusted();

  const user = await getCurrentAuthUser();
  if (!user) {
    throw new Error("Authentifizierung erforderlich.");
  }

  await enqueueAndDispatch({
    type: "briefing",
    title: "Morning Briefing erstellen",
    userId: user.id,
    payload: {},
  });

  revalidatePath("/today");
}
