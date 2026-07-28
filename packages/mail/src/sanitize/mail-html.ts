/**
 * Aufbereitung eingehender HTML-Mails für den Reader.
 *
 * Lag in Studio (`src/lib/sanitize-html.ts`) neben dem allgemeinen
 * `sanitizeHtml`. Mit dem Mail-Center ist der Mail-Teil nach Brain gewandert —
 * und weil er Mail-Domänenlogik ist und keine App-Zutat, liegt er jetzt hier.
 * Der allgemeine Sanitizer bleibt in Studio: den benutzt das Wiki.
 */

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

const REMOTE_URL_PATTERN = /^https?:\/\//i;
const PROTOCOL_RELATIVE_URL_PATTERN = /^\/\//;
const REMOTE_CSS_URL_PATTERN = /url\(\s*['"]?https?:\/\//i;

export function buildMailImageProxyUrl(messageId: string, remoteUrl: string): string {
  const encoded = encodeURIComponent(remoteUrl);
  return `/api/mail/messages/${messageId}/images/proxy?url=${encoded}`;
}

/**
 * Sanitizes an inbound HTML mail body for display in the mail reader.
 *
 * Unlike Studios `sanitizeHtml` (outbound DM-composed mail previews),
 * this keeps the `style` attribute — marketing/newsletter HTML relies almost
 * entirely on inline styles for layout — but forbids the `<style>` element so
 * a message can't inject page-wide CSS into the surrounding Brain UI, and
 * strips `class`/`id` so a message can't collide with host-page selectors.
 *
 * Remote (`http(s)://`) image loads are blocked by default (classic
 * tracking-pixel privacy leak) and moved into a `data-uwe-remote-src`
 * attribute; the reader can reveal them per-message on explicit user action.
 * `data:`/`cid:`-embedded images (mailparser already inlines `cid:` refs as
 * `data:` URIs) are left untouched since they never hit the network.
 */
export function sanitizeMailBodyHtml(html: string, options?: { messageId?: string; revealRemoteImages?: boolean }): string {
  if (!html) {
    return "";
  }

  const messageId = options?.messageId;
  const revealRemoteImages = options?.revealRemoteImages ?? false;

  const blockRemoteImages = (node: Element) => {
    if (!node.tagName) return;
    const tag = node.tagName;

    if (tag === "IMG") {
      const src = node.getAttribute("src") ?? "";
      const isRemote = REMOTE_URL_PATTERN.test(src) || PROTOCOL_RELATIVE_URL_PATTERN.test(src);
      if (isRemote) {
        const absolute = PROTOCOL_RELATIVE_URL_PATTERN.test(src) ? `https:${src}` : src;
        if (revealRemoteImages && messageId) {
          node.setAttribute("src", buildMailImageProxyUrl(messageId, absolute));
        } else {
          node.removeAttribute("src");
          node.setAttribute("data-uwe-remote-src", absolute);
        }
      }
      if (node.hasAttribute("srcset")) node.removeAttribute("srcset");
    } else if (tag === "SOURCE" && node.hasAttribute("srcset")) {
      node.removeAttribute("srcset");
    }

    if (node.hasAttribute("background")) {
      node.removeAttribute("background");
    }

    const style = node.getAttribute("style");
    if (style && REMOTE_CSS_URL_PATTERN.test(style)) {
      node.removeAttribute("style");
    }
  };

  const purify = getDOMPurify();
  purify.addHook("afterSanitizeAttributes", blockRemoteImages);
  try {
    return purify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["class", "id"],
      ADD_ATTR: ["data-uwe-remote-src"],
    });
  } finally {
    purify.removeHook("afterSanitizeAttributes");
  }
}
