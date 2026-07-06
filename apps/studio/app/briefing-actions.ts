"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { revalidatePath } from "next/cache";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

export async function generateMorningBriefingAction() {
  await requireStudioActionAuth();

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
