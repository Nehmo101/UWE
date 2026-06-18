export interface WorkflowRunStatus {
  runId: number | null;
  status: string | null;
  conclusion: string | null;
  htmlUrl: string | null;
}

interface GitHubWorkflowRunsResponse {
  workflow_runs?: Array<{
    id?: number;
    status?: string;
    conclusion?: string | null;
    html_url?: string;
  }>;
}

export async function fetchWorkflowRunStatus(
  owner: string,
  repo: string,
  token: string,
  branchName: string,
): Promise<WorkflowRunStatus> {
  const params = new URLSearchParams({
    branch: branchName,
    per_page: "1",
    event: "workflow_dispatch",
  });

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub workflow status failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as GitHubWorkflowRunsResponse;
  const run = data.workflow_runs?.[0];

  return {
    runId: run?.id ?? null,
    status: run?.status ?? null,
    conclusion: run?.conclusion ?? null,
    htmlUrl: run?.html_url ?? null,
  };
}
