"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSettingsService, prisma } from "@uwe/database/server";
import { requireAdminAccess } from "@/src/lib/auth";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

export async function activateAiGeneralPromptAction(formData: FormData) {
  await requireStudioActionAuth();
  await requireAdminAccess();

  const prompt = String(formData.get("prompt") ?? "").trim();
  await createSettingsService(prisma).updateSettings({
    ai: { generalChatSystemPrompt: prompt || null },
  });

  revalidatePath("/admin/ai-prompt");
  redirect("/admin/ai-prompt?activated=1");
}
