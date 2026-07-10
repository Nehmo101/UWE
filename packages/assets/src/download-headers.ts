/** Build safe HTTP headers for serving uploaded assets. */
export function buildAssetDownloadHeaders(input: {
  mimeType: string | null | undefined;
  size: number;
  title?: string | null;
  inline?: boolean;
}): Record<string, string> {
  const mime = input.mimeType?.trim() || "application/octet-stream";
  const safeTitle = sanitizeDownloadFilename(input.title ?? "asset");
  const disposition = input.inline !== false && isInlineSafeMime(mime) ? "inline" : "attachment";

  return {
    "Content-Type": mime,
    "Content-Length": String(input.size),
    "Content-Disposition": `${disposition}; filename="${safeTitle}"; filename*=UTF-8''${encodeURIComponent(safeTitle)}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Frame-Options": "DENY",
    // Assets are content-addressed by storageKey and effectively immutable, so a
    // private hour-long cache lets browsers reuse them across navigations without
    // re-downloading. `private` keeps them out of shared/proxy caches.
    "Cache-Control": "private, max-age=3600",
  };
}

function sanitizeDownloadFilename(title: string): string {
  const cleaned = title
    .replace(/[\x00-\x1f\x7f"\\]/g, "")
    .replace(/\.\./g, "")
    .trim()
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : "asset";
}

function isInlineSafeMime(mime: string): boolean {
  return (
    mime.startsWith("image/") &&
    mime !== "image/svg+xml" &&
    mime !== "text/html"
  );
}
