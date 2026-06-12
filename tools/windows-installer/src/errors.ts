export class InstallerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "InstallerError";
    this.code = code;
  }
}

export const ERROR_MESSAGES = {
  NODE_MISSING: "Node.js is missing or the version is too old.",
  PNPM_MISSING: "pnpm is missing or the installation failed.",
  PORTS_BUSY: "One or more required ports are already in use.",
  DB_MIGRATION_FAILED: "Database migration failed. Check logs for details.",
  WRITE_DENIED: "The installer cannot write to the selected directory.",
  BUNDLE_MISSING: "The release bundle or repository source was not found.",
  START_FAILED: "UWE could not be started. Check logs for details.",
  GIT_MISSING: "Git is required for clone/update mode but was not found.",
} as const;
