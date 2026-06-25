import { NextResponse } from "next/server";
import {
  createDevAgentJobService,
  prisma,
  resolveAgentJobsConfig,
} from "@uwe/database/server";
import { idSchema, nonEmptyString, parseBody } from "@uwe/security";
import { requireAgentJobCallbackAuth } from "@/src/lib/agent-job-callback-auth";
import { z } from "zod";

const agentJobCallbackSchema = z.object({
  job_id: idSchema,
  status: z.enum(["completed", "failed"]),
  pr_url: z.string().url().optional().nullable(),
  branch_name: nonEmptyString.max(200).optional().nullable(),
  error_message: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  const authError = requireAgentJobCallbackAuth(request);
  if (authError) return authError;

  const config = resolveAgentJobsConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: "Agent Jobs sind deaktiviert." }, { status: 403 });
  }

  const parsed = await parseBody(request, agentJobCallbackSchema);
  if (!parsed.success) return parsed.response;

  const agentJobs = createDevAgentJobService(prisma);

  try {
    const job = await agentJobs.applyCompletionCallback(parsed.data.job_id, {
      status: parsed.data.status,
      prUrl: parsed.data.pr_url ?? null,
      branchName: parsed.data.branch_name ?? null,
      errorMessage: parsed.data.error_message ?? null,
    });
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Callback fehlgeschlagen.";
    const status = message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
