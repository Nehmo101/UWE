/**
 * Bildblöcke als HTML — geteilt von Studio und Portal.
 *
 * Ohne das bleiben Blöcke mit `assetId` unsichtbar: die Renderer kennen nur
 * `block.content`, und ein Bildblock hat dort nichts stehen. Betrifft alle
 * Bildblöcke, nicht nur die aus dem PDF-Import.
 *
 * Die Asset-URL kommt vom Aufrufer, weil die beiden Apps unterschiedliche
 * Verträge haben: Studio liefert unter `/api/assets/<id>/file` aus, das Portal
 * verlangt zusätzlich `?world=<slug>`, weil dort die Welt-Zuordnung über den
 * Zugriff entscheidet.
 *
 * Sicherheit: Dieses Modul filtert nichts. Die Aufrufer reichen nur Blöcke
 * herein, die `filterBlocksForViewer` bereits freigegeben hat.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtmlAttribute(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/** Blocktypen, die als Bild ausgeliefert werden. */
const ASSET_BLOCK_TYPES = new Set(["image", "gallery", "map", "handout"]);

export interface AssetBlockLike {
  type: string;
  assetId: string | null;
  content: string | null;
}

export interface RenderAssetBlockOptions {
  /** Baut die Quell-URL für ein Asset. */
  assetUrl: (assetId: string) => string;
}

/**
 * Ergänzt einen Bildblock um sein Bild. Blöcke ohne Asset oder mit einem
 * Nicht-Bild-Typ kommen unverändert zurück, damit ein versehentlich gesetztes
 * Asset nicht plötzlich als Bild auftaucht.
 */
export function renderAssetBlockHtml(
  block: AssetBlockLike,
  captionHtml: string,
  options: RenderAssetBlockOptions,
): string {
  if (!block.assetId || !ASSET_BLOCK_TYPES.has(block.type)) {
    return captionHtml;
  }
  const src = escapeHtmlAttribute(options.assetUrl(block.assetId));
  const alt = escapeHtmlAttribute((block.content ?? "").trim() || "Bild zur Seite");
  const caption = captionHtml ? `<figcaption>${captionHtml}</figcaption>` : "";
  return `<figure class="wiki-figure"><img src="${src}" alt="${alt}" loading="lazy" />${caption}</figure>`;
}

/** Asset-URL für Studio: dort entscheidet das Studio-Häkchen über den Zugriff. */
export function studioAssetUrl(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}/file`;
}

/**
 * Asset-URL fürs Portal. Der `world`-Parameter ist Pflicht — die Route bindet
 * das Asset an die Welt und prüft den Zugriff gegen genau diese.
 */
export function portalAssetUrl(worldSlug: string): (assetId: string) => string {
  return (assetId) =>
    `/api/assets/${encodeURIComponent(assetId)}/file?world=${encodeURIComponent(worldSlug)}`;
}
