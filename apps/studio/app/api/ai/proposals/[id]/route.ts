import { getProposal } from "../../../../../src/lib/ai-handlers";
import { requireStudioApiAuth } from "../../../../../src/lib/studio-api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { id } = await params;
  return getProposal(id);
}
