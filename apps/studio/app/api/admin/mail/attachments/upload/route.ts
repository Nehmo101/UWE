import { NextResponse } from "next/server";
import { storeOutboundAttachment, MAX_OUTBOUND_ATTACHMENT_BYTES } from "@uwe/mail";
import { requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

/** Uploads a single outbound attachment; returns an opaque key for the send call. */
export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return mailApiError("Ungültiger Upload (multipart/form-data erwartet).");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return mailApiError("Feld 'file' fehlt.");
  if (file.size > MAX_OUTBOUND_ATTACHMENT_BYTES) {
    return mailApiError("Anhang überschreitet das Größenlimit (25 MB).", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeOutboundAttachment(buffer, file.name, file.type);
  return NextResponse.json({ attachment: stored }, { status: 201 });
}
