/** Standard YouTube video IDs are 11 characters (base64url-ish). */
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function isValidYouTubeVideoId(id: string | undefined | null): id is string {
  return typeof id === "string" && YOUTUBE_VIDEO_ID_PATTERN.test(id);
}

function normalizeYouTubeHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

/**
 * Extracts a YouTube video ID from common URL formats:
 * - youtube.com/watch?v=
 * - youtu.be/
 * - youtube.com/shorts/
 * - youtube.com/embed/
 */
export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = normalizeYouTubeHost(parsed.hostname);

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return isValidYouTubeVideoId(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (isValidYouTubeVideoId(fromQuery)) {
        return fromQuery;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      for (const segment of ["shorts", "embed", "live", "v"] as const) {
        const index = parts.indexOf(segment);
        if (index >= 0 && isValidYouTubeVideoId(parts[index + 1])) {
          return parts[index + 1]!;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

export function getYouTubeThumbnailUrl(videoId: string, quality: "default" | "hqdefault" = "hqdefault"): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
