/**
 * `@uwe/cloudflare-edge` — the Cloudflare edge configuration UWE owns itself.
 *
 * Today that is the **Managed Challenge**: the full-page "Verify you are human"
 * interstitial in front of the UWE hostnames, modelled as a single WAF custom
 * rule that UWE creates, updates and removes through the Cloudflare API instead
 * of the operator clicking through the dashboard.
 *
 * See docs/cloudflare-current-setup.md.
 */

export {
  DEFAULT_MANAGED_CHALLENGE_CONFIG,
  DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS,
  MANAGED_CHALLENGE_PHASE,
  MANAGED_CHALLENGE_RULE_DESCRIPTION,
  MANAGED_CHALLENGE_RULE_REF,
  buildManagedChallengeExpression,
  buildManagedChallengeRule,
  collectManagedChallengeIssues,
  formatListInput,
  hasActiveManagedChallenge,
  isManagedChallengeRule,
  mergeManagedChallengeRule,
  normalizeChallengeHostname,
  normalizeChallengeSkipPath,
  normalizeManagedChallengeConfig,
  parseListInput,
  type CloudflareRule,
  type ManagedChallengeAction,
  type ManagedChallengeConfig,
} from "./managed-challenge";

export {
  readManagedChallengeConfig,
  resolveManagedChallengeConfigPath,
  writeManagedChallengeConfig,
} from "./config-file";

export {
  buildTunnelIngressPlan,
  decodeTunnelToken,
  ingressMatchesPlan,
  mergeTunnelIngress,
  planToIngressRules,
  type MergedIngress,
  type TunnelIdentity,
  type TunnelIngressPlan,
  type TunnelIngressRule,
  type TunnelRoutePlan,
} from "./tunnel-ingress";

export {
  applyTunnelIngress,
  fetchTunnelIngressState,
  type ApplyTunnelIngressResult,
  type DnsOutcome,
  type DnsRecordResult,
  type TunnelApiOptions,
  type TunnelIngressState,
} from "./tunnel-client";

export {
  applyManagedChallenge,
  fetchManagedChallengeState,
  hasCloudflareCredentials,
  type ApplyManagedChallengeResult,
  type CloudflareApiOptions,
  type CloudflareEdgeCredentials,
  type ManagedChallengeState,
} from "./ruleset-client";
