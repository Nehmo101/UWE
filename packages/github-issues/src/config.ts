/**
 * Repo- und Token-Konfiguration für das Anlegen von GitHub-Issues aus dem
 * Bug-Center. Rein serverseitig — der Token verlässt den Host nie.
 */
export interface GitHubIssueConfig {
  /** Zielrepository im Format `owner/repo`, oder `null` wenn nicht gesetzt. */
  repo: string | null;
  /** Personal Access Token mit `issues:write`, oder `null` wenn nicht gesetzt. */
  token: string | null;
}

export function resolveGitHubIssueConfig(
  env: NodeJS.ProcessEnv = process.env,
): GitHubIssueConfig {
  return {
    repo: env.GITHUB_ISSUE_REPO?.trim() || null,
    token: env.GITHUB_TOKEN?.trim() || env.GITHUB_ISSUE_TOKEN?.trim() || null,
  };
}

/** Zerlegt `owner/repo`; `null` wenn das Format nicht stimmt. */
export function splitGitHubRepo(repo: string): { owner: string; name: string } | null {
  const [owner, name] = repo.split("/");
  if (!owner || !name) return null;
  return { owner, name };
}
