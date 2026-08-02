export interface CreateGitHubIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

export interface CreateGitHubIssueResult {
  success: boolean;
  issueUrl?: string;
  issueNumber?: number;
  error?: string;
}

interface GitHubIssueResponse {
  html_url?: string;
  number?: number;
}

export async function createGitHubIssue(
  owner: string,
  repo: string,
  token: string,
  input: CreateGitHubIssueInput,
): Promise<CreateGitHubIssueResult> {
  const title = input.title.trim();
  if (!title) {
    return { success: false, error: "Issue-Titel ist erforderlich." };
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title,
      body: input.body,
      ...(input.labels?.length ? { labels: input.labels } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      success: false,
      error: `GitHub Issue-Erstellung fehlgeschlagen (${response.status}): ${text.slice(0, 300)}`,
    };
  }

  const data = (await response.json()) as GitHubIssueResponse;
  if (!data.html_url) {
    return { success: false, error: "GitHub-Antwort enthielt keine Issue-URL." };
  }

  return {
    success: true,
    issueUrl: data.html_url,
    issueNumber: data.number,
  };
}
