import { NextResponse } from "next/server";
import { guardStudioMutation } from "@uwe/security";
import { storeImageAsset } from "@/src/lib/image-asset-upload";
import { ownerForbiddenResponse, resolveOwnerApiUser } from "@/src/lib/owner-api-auth";

export async function POST(request: Request) {
  const authError = guardStudioMutation(request, { rateLimit: "upload" });
  if (authError) return authError;

  const owner = await resolveOwnerApiUser();
  if (!owner) return ownerForbiddenResponse();

  const formData = await request.formData();
  const result = await storeImageAsset(formData.get("file"), {
    source: "idea_attachment",
    defaultTitle: "Ideen-Anhang",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.asset);
}
