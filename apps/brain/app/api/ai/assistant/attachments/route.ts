import { NextResponse } from "next/server";
import { storeAssistantAttachment, UploadValidationError } from "@uwe/brain-assistant";
import {
  assistantError,
  assistantService,
  guardAssistantApi,
  resolveUploadsRootForAssistant,
} from "@/src/lib/assistant-api";

/** Upload one image/PDF/text attachment for a conversation, before it is sent. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guardError = await guardAssistantApi(request, "upload");
  if (guardError) return guardError;

  const formData = await request.formData();
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  if (!conversationId) {
    return assistantError("Keine Unterhaltung angegeben.");
  }

  const service = assistantService();
  if (!(await service.getConversation(conversationId))) {
    return assistantError("Diese Unterhaltung existiert nicht.", 404);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return assistantError("Keine Datei übermittelt.");
  }

  try {
    const stored = await storeAssistantAttachment({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalFilename: file.name,
      declaredMimeType: file.type || null,
      uploadsRoot: await resolveUploadsRootForAssistant(),
    });
    const attachment = await service.createAttachment({ conversationId, ...stored });
    return NextResponse.json({ attachment });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return assistantError(`Datei abgelehnt: ${error.message}`, 400);
    }
    return assistantError("Upload fehlgeschlagen.", 500);
  }
}
