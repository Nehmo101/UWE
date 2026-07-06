import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getSettings } from "../../../../src/lib/ai-handlers";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  return getSettings();
}
