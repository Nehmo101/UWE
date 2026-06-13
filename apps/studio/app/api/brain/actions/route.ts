import { getBrainActions } from "../../../../src/lib/brain-handlers";
import { requireStudioApiAuth } from "../../../../src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  return getBrainActions();
}
