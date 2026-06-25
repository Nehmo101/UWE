/**
 * UWE Agent Jobs — dispatch development prompts to GitHub Actions or Cursor Cloud Agents.
 * Results are branches/PRs/issues — never auto-merge.
 */

import { fetchWorkflowRunStatus } from "./github-status";

export { fetchWorkflowRunStatus, fetchPullRequestForBranch, type WorkflowRunStatus, type PullRequestSummary } from "./github-status";

export type DevAgentJobProvider = "github_actions" | "cursor_cloud" | "cursor_cli_local";

export interface AgentJobDispatchInput {
  jobId: string;
  title: string;
  prompt: string;
  provider: DevAgentJobProvider;
}

export interface AgentJobDispatchResult {
  success: boolean;
  provider: DevAgentJobProvider;
  githubRunId?: string;
  cursorJobId?: string;
  branchName?: string;
  prUrl?: string;
  error?: string;
}

export interface AgentJobsDispatchConfig {
  githubRepo: string | null;
  githubWorkflow: string;
  githubToken: string | null;
  cursorCloudApiKey: string | null;
  cursorCloudApiUrl: string;
  defaultBranch: string;
}

export function resolveAgentJobsDispatchConfig(
  env: NodeJS.ProcessEnv = process.env,
): AgentJobsDispatchConfig {
  return {
    githubRepo: env.AGENT_JOBS_GITHUB_REPO?.trim() || null,
    githubWorkflow: env.AGENT_JOBS_GITHUB_WORKFLOW?.trim() || "cursor-agent.yml",
    githubToken: env.GITHUB_TOKEN?.trim() || env.AGENT_JOBS_GITHUB_TOKEN?.trim() || null,
    cursorCloudApiKey: env.CURSOR_CLOUD_API_KEY?.trim() || null,
    cursorCloudApiUrl:
      env.CURSOR_CLOUD_API_URL?.trim() || "https://api.cursor.com/v0/agents",
    defaultBranch: env.AGENT_JOBS_DEFAULT_BRANCH?.trim() || "main",
  };
}

function slugifyBranch(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `cursor/${slug || "agent-job"}-${Date.now().toString(36)}`;
}

export async function dispatchGitHubActionsJob(
  input: AgentJobDispatchInput,
  config: AgentJobsDispatchConfig,
): Promise<AgentJobDispatchResult> {
  if (!config.githubToken) {
    return {
      success: false,
      provider: "github_actions",
      error: "GITHUB_TOKEN oder AGENT_JOBS_GITHUB_TOKEN nicht gesetzt.",
    };
  }
  if (!config.githubRepo) {
    return {
      success: false,
      provider: "github_actions",
      error: "AGENT_JOBS_GITHUB_REPO nicht gesetzt (Format: owner/repo).",
    };
  }

  const branchName = slugifyBranch(input.title);
  const [owner, repo] = config.githubRepo.split("/");
  if (!owner || !repo) {
    return {
      success: false,
      provider: "github_actions",
      error: "AGENT_JOBS_GITHUB_REPO ungültig — erwartet owner/repo.",
    };
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${config.githubWorkflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: config.defaultBranch,
        inputs: {
          prompt: input.prompt,
          title: input.title,
          job_id: input.jobId,
          branch_name: branchName,
        },
      }),
    },
  );

  if (response.status !== 204 && !response.ok) {
    const text = await response.text().catch(() => "");
    return {
      success: false,
      provider: "github_actions",
      error: `GitHub Actions Dispatch fehlgeschlagen (${response.status}): ${text.slice(0, 300)}`,
    };
  }

  let githubRunId: string | undefined;
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const runStatus = await fetchWorkflowRunStatus(owner, repo, config.githubToken, branchName);
    if (runStatus.runId != null) {
      githubRunId = String(runStatus.runId);
    }
  } catch {
    // Best effort — dispatch succeeded even if run lookup fails.
  }

  return {
    success: true,
    provider: "github_actions",
    branchName,
    githubRunId,
  };
}

export async function dispatchCursorCloudJob(
  input: AgentJobDispatchInput,
  config: AgentJobsDispatchConfig,
): Promise<AgentJobDispatchResult> {
  if (!config.cursorCloudApiKey) {
    return {
      success: false,
      provider: "cursor_cloud",
      error: "CURSOR_CLOUD_API_KEY nicht gesetzt.",
    };
  }
  if (!config.githubRepo) {
    return {
      success: false,
      provider: "cursor_cloud",
      error: "AGENT_JOBS_GITHUB_REPO für Cursor Cloud Agents erforderlich.",
    };
  }

  const response = await fetch(config.cursorCloudApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.cursorCloudApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: { text: input.prompt },
      source: { repository: `https://github.com/${config.githubRepo}`, ref: config.defaultBranch },
      target: { autoCreatePr: true, openAsCursorGithubApp: true, skipReviewerRequest: true },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      success: false,
      provider: "cursor_cloud",
      error: `Cursor Cloud Agent Fehler (${response.status}): ${text.slice(0, 300)}`,
    };
  }

  const data = (await response.json()) as { id?: string; branchName?: string; prUrl?: string };
  return {
    success: true,
    provider: "cursor_cloud",
    cursorJobId: data.id,
    branchName: data.branchName,
    prUrl: data.prUrl,
  };
}

export async function dispatchAgentJob(
  input: AgentJobDispatchInput,
  config?: AgentJobsDispatchConfig,
): Promise<AgentJobDispatchResult> {
  const resolved = config ?? resolveAgentJobsDispatchConfig();

  switch (input.provider) {
    case "github_actions":
      return dispatchGitHubActionsJob(input, resolved);
    case "cursor_cloud":
      return dispatchCursorCloudJob(input, resolved);
    case "cursor_cli_local":
      return {
        success: false,
        provider: "cursor_cli_local",
        error:
          "Cursor CLI lokal: Job wurde erstellt. Führe 'cursor agent' manuell auf dem Entwicklungsrechner aus.",
      };
    default:
      return { success: false, provider: input.provider, error: "Unbekannter Provider." };
  }
}
