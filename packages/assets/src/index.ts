export {
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
  type AssetRecord,
  type AssetType,
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
  sanitizeOriginalFilename,
} from "./storage";

export {
  ALLOWED_UPLOAD_KINDS,
  UploadValidationError,
  buildSecureStorageKey,
  buildThumbnailStorageKey,
  parseUploadVisibility,
  resolveUploadMaxBytes,
  resolveUploadPolicyConfig,
  validateUploadInput,
  type UploadPolicyConfig,
  type ValidatedUpload,
} from "./upload-policy";

export {
  BLOCKED_EXTENSIONS,
  EXTENSION_TO_KIND,
  KIND_TO_MIME,
  detectFileKind,
  extensionForKind,
  type DetectedFileKind,
  type MagicByteDetection,
} from "./magic-bytes";

export {
  ZipSecurityError,
  assertSafeZipEntryName,
  extractSafeZipEntries,
  resolveZipImportPolicy,
  type SafeZipEntry,
  type ZipImportPolicy,
} from "./zip-security";

export { buildAssetDownloadHeaders } from "./download-headers";

export {
  cropImageRegion,
  downscaleImageForVision,
  processUploadedImage,
  shouldGenerateThumbnails,
  shouldStripExif,
  type DownscaledImage,
  type ImageCropRect,
  type ProcessedImageResult,
} from "./image-processing";

export {
  resolveAllDataPaths,
  resolveBackupsDirFromEnv,
  resolveDataDir,
  resolveDatabaseFilePath,
  resolveExportsDirFromEnv,
  resolveUploadsDirFromEnv,
  type ResolvedDataPaths,
} from "./data-paths";

export const ASSETS_PACKAGE_VERSION = "0.2.0";
