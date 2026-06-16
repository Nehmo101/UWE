import { getSettings } from "../../../../src/lib/ai-handlers";
import { requireStudioApiAuth } from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  return getSettings();
}
