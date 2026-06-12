export const MIN_NODE_MAJOR = 20;
export const MIN_PNPM_MAJOR = 10;
export const DEFAULT_STUDIO_PORT = 3000;
export const DEFAULT_PORTAL_PORT = 3001;
export const DEFAULT_HOST = "127.0.0.1";
export const MIN_FREE_DISK_BYTES = 2 * 1024 * 1024 * 1024;
export const INSTALLER_STATE_VERSION = 1;

export const DATA_SUBDIRS = [
  "data",
  "data/uploads",
  "data/backups",
  "exports",
  "logs",
  "config",
] as const;
