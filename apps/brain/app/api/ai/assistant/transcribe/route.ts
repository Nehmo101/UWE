import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { transcribeAssistantAudio } from "@uwe/brain-assistant";
import { assistantError, assistantService, guardAssistantApi } from "@/src/lib/assistant-api";

/**
 * Dictation: browser recording → local connector → transcript.
 *
 * The recording is transcribed in memory and never written to disk — only the
 * text comes back, and the client puts it into the composer for editing rather
 * than sending it straight to the model.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const guardError = await guardAssistantApi(request, "ai");
  if (guardError) return guardError;

  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return assistantError("Keine Aufnahme übermittelt.");
  }

  const profile = await assistantService().getProfile();
  const result = await transcribeAssistantAudio(prisma, {
    buffer: Buffer.from(await file.arrayBuffer()),
    // The browser's declared type wins: audio/webm and video/webm share a magic
    // header, so content sniffing would hand the engine the wrong container.
    mimeType: file.type || "audio/webm",
    model: profile.sttModelName,
    language: "de",
  });

  if (result.kind === "unavailable") {
    return NextResponse.json({ error: result.message, unavailable: true }, { status: 503 });
  }

  return NextResponse.json({ text: result.text, model: result.model });
}
