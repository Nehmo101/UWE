export {
  assertProductionEnvReady,
  collectEnvValidationIssues,
  EnvValidationError,
  formatEnvValidationError,
  getUweEnvOrNull,
  isWeakSecret,
  MIN_SECRET_LENGTH,
  parseUweEnv,
  RECOMMENDED_SECRET_LENGTH,
  resolveRawEnv,
  syncLegacyEnvAliases,
  WEAK_SECRET_PATTERNS,
  type ResolvedRawEnv,
  type UweEnv,
} from "./config/env";

export { warnAboutLegacyRtxEnvVars } from "./legacy-env";
export { redactError, redactSecrets } from "./redact";
