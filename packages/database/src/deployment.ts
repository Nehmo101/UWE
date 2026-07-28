/**
 * Public subpath entry for owner-editable deployment / routing / security configuration
 * (`@uwe/database/deployment`). Kept separate from the frozen `./server` barrel per the
 * module-discipline rules — import deployment helpers and the boot-time overlay loader
 * from here.
 *
 * Bewusst namentlich re-exportiert statt `export *`: Die Kommandozentrale startet ihre
 * CLIs mit `node --import tsx`. Dort wird das Ziel-Modul als CJS geladen, und der
 * ESM-Linker sieht die Namen hinter einem Stern-Re-Export nicht — jeder Import scheiterte
 * mit „does not provide an export named …“, obwohl Typecheck und Tests grün sind.
 * Neue Symbole hier mit aufnehmen.
 */
export {
  DEFAULT_DEPLOYMENT_SETTINGS,
  applyDeploymentRuntimeOverrides,
  buildDeploymentEnvOverrides,
  buildDeploymentSettingsUpdate,
  normalizeDeploymentSettings,
  resolveCloudflareEdgeCredentials,
  sanitizeDeploymentSettingsForClient,
} from "./deployment-settings";

export type {
  BrainExposure,
  CloudflareEdgeCredentials,
  DeploymentOverride,
  DeploymentSettings,
  DeploymentSettingsInput,
} from "./deployment-settings";

export { refreshDeploymentRuntimeOverrides } from "./settings-service";
