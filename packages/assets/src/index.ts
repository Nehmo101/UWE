export {
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
  type AssetRecord,
  type AssetType,
  type AssetVisibility,
  type CreateAssetInput,
  type UpdateAssetInput,
} from "./types";

export {
  UPLOADS_DIR_NAME,
  buildStorageKey,
  ensureUploadDirectory,
  inferAssetTypeFromMime,
  inferMimeTypeFromFilename,
  resolveAssetFilePath,
  resolveUploadsRoot,
} from "./storage";

export {
  resolveAllDataPaths,
  resolveBackupsDirFromEnv,
  resolveDataDir,
  resolveDatabaseFilePath,
  resolveExportsDirFromEnv,
  resolveUploadsDirFromEnv,
  type ResolvedDataPaths,
} from "./data-paths";

export {
  PORTAL_ASSET_VISIBILITIES,
  filterAssetsForContext,
  isAssetAccessible,
  isPortalAssetVisibility,
  type AssetAccessContext,
} from "./permissions";

export const ASSETS_PACKAGE_VERSION = "0.2.0";
