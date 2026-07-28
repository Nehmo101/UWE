interface DomPurifyInstance {
  sanitize: (html: string, config?: Record<string, unknown>) => string;
  addHook: (name: string, hook: (node: Element) => void) => void;
  removeHook: (name: string) => void;
}

let domPurify: DomPurifyInstance | null = null;

/** Lazy init — top-level isomorphic-dompurify pulls in jsdom and breaks `next build`. */
function getDOMPurify(): DomPurifyInstance {
  if (!domPurify) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    domPurify = require("isomorphic-dompurify").default as DomPurifyInstance;
  }
  return domPurify;
}

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

  return getDOMPurify().sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style"],
  });
}
