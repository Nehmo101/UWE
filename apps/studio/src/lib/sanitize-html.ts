import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes untrusted HTML before it is rendered via dangerouslySetInnerHTML.
 *
 * Uses the DOMPurify default HTML profile (common formatting tags like
 * p/strong/em/ul/li/table/a/img stay allowed) and additionally forbids
 * style/script containers. DOMPurify already strips event-handler attributes
 * (onerror, onclick, …) and javascript:-URLs by default.
 *
 * Works on the server (SSR) and in the browser via isomorphic-dompurify.
 */
export function sanitizeHtml(html: string): string {
  if (!html) {
    return "";
  }

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style"],
  });
}
