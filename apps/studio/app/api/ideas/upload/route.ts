import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { storeImageAsset } from "@/src/lib/image-asset-upload";
import { ownerForbiddenResponse, resolveOwnerApiUser } from "@/src/lib/owner-api-auth";

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const owner = await resolveOwnerApiUser();
  if (!owner) return ownerForbiddenResponse();

  const formData = await request.formData();
  const result = await storeImageAsset(formData.get("file"), {
    source: "idea_attachment",
    defaultTitle: "Ideen-Anhang",
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json(result.asset);
}
