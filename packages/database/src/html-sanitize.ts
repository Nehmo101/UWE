interface DomPurifyInstance {
  sanitize: (html: string, config?: Record<string, unknown>) => string;
}

let domPurify: DomPurifyInstance | null = null;

/**
 * Lazy init — a top-level import of isomorphic-dompurify pulls in jsdom, which
 * breaks `next build` and bloats CLI/seed entry points that never render HTML.
 * Requiring it inside the function keeps the cost to the render path only.
 */
function getDOMPurify(): DomPurifyInstance {
  if (!domPurify) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    domPurify = require("isomorphic-dompurify").default as DomPurifyInstance;
  }
  return domPurify;
}

/**
 * Sanitizes authored wiki HTML (TipTap rich text, imported HTML, resolved
 * wikilink anchors) before it is handed to `dangerouslySetInnerHTML` in the
 * Portal or Studio.
 *
 * Keeps the common formatting/structure tags the rich-text editor produces
 * (p, headings, lists, strong/em, blockquote, code, links, images) plus the
 * wikilink anchor/`span` classes, but strips script/style/embed containers and
 * inline `style`. DOMPurify already removes event-handler attributes
 * (`onerror`, `onclick`, …) and `javascript:` URLs by default.
 *
 * Runs on the server (SSR) and in the browser via isomorphic-dompurify.
 */
export function sanitizeWikiHtml(html: string): string {
  if (!html) {
    return "";
  }

  return getDOMPurify().sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style"],
  });
}
