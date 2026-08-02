/**
 * UWE GitHub Issues — Bug-Reports aus dem Studio-Bug-Center als GitHub-Issue
 * anlegen. Bewusst schmal: nur Issue-Erstellung, kein Dispatch, kein Agent.
 */

export {
  createGitHubIssue,
  type CreateGitHubIssueInput,
  type CreateGitHubIssueResult,
} from "./create-issue";
export {
  resolveGitHubIssueConfig,
  splitGitHubRepo,
  type GitHubIssueConfig,
} from "./config";
