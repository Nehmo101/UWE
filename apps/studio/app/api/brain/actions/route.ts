import { getBrainActions } from "../../../../src/lib/brain-handlers";
import { requireStudioApiAuth } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await requireStudioApiAuth(request);
  if (authError) return authError;

  return getBrainActions();
}
