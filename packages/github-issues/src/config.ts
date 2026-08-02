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

/**
 * Zerlegt `owner/repo`; `null` wenn das Format nicht stimmt.
 *
 * Genau zwei Segmente — `owner/repo/extra` ist ungültig und darf nicht still
 * auf `owner/repo` zurückfallen, sonst legt ein Tippfehler in
 * `GITHUB_ISSUE_REPO` das Issue in einem anderen Repository an.
 */
export function splitGitHubRepo(repo: string): { owner: string; name: string } | null {
  const segments = repo.split("/");
  if (segments.length !== 2) return null;
  const [owner, name] = segments;
  if (!owner?.trim() || !name?.trim()) return null;
  return { owner: owner.trim(), name: name.trim() };
}
