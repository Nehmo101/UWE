export type InstallMode = "release" | "dev";

export interface InstallPaths {
  root: string;
  app: string;
  data: string;
  uploads: string;
  backups: string;
  exports: string;
  logs: string;
  config: string;
  envFile: string;
  stateFile: string;
  studioPidFile: string;
  portalPidFile: string;
}

export interface PortConfig {
  studioPort: number;
  portalPort: number;
  studioHost: string;
  portalHost: string;
}

export interface InstallerConfig {
  mode: InstallMode;
  paths: InstallPaths;
  ports: PortConfig;
  bundlePath?: string;
  repoPath?: string;
  runDbSeed: "auto" | "true" | "false";
  dryRun: boolean;
}

export interface SystemCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, string>;
}

export interface CommandResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}
