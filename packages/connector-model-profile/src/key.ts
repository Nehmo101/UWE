/**
 * Stable identity for a model profile.
 *
 * A model is identified by its provider and technical name. Filesystem models
 * can share a name across directories, so the absolute path is folded in when
 * present. The key is used both as the profile `id` and to match a persisted
 * profile against a freshly discovered model.
 */

function normalizePathSegment(path: string): string {
  // Normalize separators and trim trailing slashes so the same file always maps
  // to the same key regardless of how the path was entered.
  return path.replace(/\\/g, "/").replace(/\/+$/, "").trim();
}

export function modelProfileKey(provider: string, name: string, path?: string | null): string {
  const base = `${provider.trim().toLowerCase()}::${name.trim()}`;
  const normalizedPath = path ? normalizePathSegment(path) : "";
  return normalizedPath ? `${base}::${normalizedPath}` : base;
}
