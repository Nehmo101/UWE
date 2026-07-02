/**
 * Print-freundliche Ansicht für generierte Dokumente (Dokumentengenerator D4).
 * Konvention wie character-sheet-export.ts: pures HTML ohne App-Chrome,
 * ausgeliefert über eine Studio-API-Route.
 */

export interface DocumentPrintInput {
  title: string;
  content: string;
  categoryLabel?: string | null;
  templateName?: string | null;
  generatedAt?: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDocumentPrintStyles(): string {
  return `
    @page { size: A4 portrait; margin: 18mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: #111;
      background: #fff;
      font-size: 11pt;
      line-height: 1.45;
    }
    .doc-sheet { max-width: 760px; margin: 0 auto; padding: 1rem; }
    .doc-header { border-bottom: 2px solid #111; margin-bottom: 1rem; padding-bottom: 0.5rem; }
    .doc-header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
    .doc-meta { color: #555; font-size: 0.85rem; margin: 0.25rem 0 0; }
    .doc-body { white-space: pre-wrap; word-wrap: break-word; }
    .doc-toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .doc-toolbar button {
      font: inherit;
      padding: 0.35rem 0.75rem;
      border: 1px solid #333;
      background: #fff;
      color: #111;
      cursor: pointer;
      border-radius: 4px;
    }
    @media print {
      .doc-toolbar { display: none !important; }
      .doc-sheet { padding: 0; max-width: none; }
    }
  `;
}

export function buildDocumentPrintHtml(
  input: DocumentPrintInput,
  options?: { includeToolbar?: boolean },
): string {
  const includeToolbar = options?.includeToolbar ?? true;

  const metaParts: string[] = [];
  if (input.templateName?.trim()) {
    metaParts.push(`Vorlage: ${escapeHtml(input.templateName.trim())}`);
  }
  if (input.categoryLabel?.trim()) {
    metaParts.push(escapeHtml(input.categoryLabel.trim()));
  }
  if (input.generatedAt?.trim()) {
    metaParts.push(`Erstellt: ${escapeHtml(input.generatedAt.slice(0, 10))}`);
  }

  const toolbar = includeToolbar
    ? `<div class="doc-toolbar">
        <button type="button" onclick="window.print()">Drucken</button>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>${buildDocumentPrintStyles()}</style>
</head>
<body>
  <div class="doc-sheet">
    ${toolbar}
    <header class="doc-header">
      <h1>${escapeHtml(input.title)}</h1>
      ${metaParts.length > 0 ? `<p class="doc-meta">${metaParts.join(" · ")}</p>` : ""}
    </header>
    <div class="doc-body">${escapeHtml(input.content)}</div>
  </div>
</body>
</html>`;
}
