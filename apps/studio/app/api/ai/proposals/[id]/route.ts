import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { getProposal } from "../../../../../src/lib/ai-handlers";
import { idSchema, parseParams } from "@uwe/security";
import { z } from "zod";

const proposalIdParamSchema = z.object({ id: idSchema });

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsedParams = await parseParams(params, proposalIdParamSchema);
  if (!parsedParams.success) return parsedParams.response;

  return getProposal(parsedParams.data.id);
}
