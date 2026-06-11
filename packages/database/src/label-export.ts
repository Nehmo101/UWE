import type { LabelContentData, LabelLayoutSettings } from "./label-service";

export interface LabelExportOptions {
  content: LabelContentData;
  layoutSettings: LabelLayoutSettings;
  title: string;
  imageUrl?: string | null;
  worldName?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelStyles(settings: LabelLayoutSettings): string {
  const w = settings.widthInches;
  const h = settings.heightInches;

  return `
    @page {
      size: ${w}in ${h}in;
      margin: 0.2in;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: #111;
      background: #fff;
    }

    .label-page {
      width: ${w}in;
      height: ${h}in;
      padding: 0.2in;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      page-break-after: always;
    }

    .label-title {
      font-size: 14pt;
      font-weight: 700;
      margin: 0 0 0.12in;
      line-height: 1.2;
    }

    .label-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.1in;
      min-height: 0;
    }

    .label-image-wrap {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .label-image-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .label-text {
      font-size: 10pt;
      line-height: 1.35;
      white-space: pre-wrap;
      overflow: hidden;
    }

    .label-mode-image_text .label-body {
      flex-direction: column;
    }

    .label-mode-image_text .label-image-wrap {
      max-height: 55%;
    }

    .label-mode-text_only .label-text {
      font-size: 11pt;
    }

    .label-mode-image_only .label-image-wrap {
      flex: 1;
    }

    .label-footer {
      font-size: 7pt;
      color: #666;
      margin-top: auto;
      padding-top: 0.05in;
    }

    .label-dm-warning {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      padding: 0.08in;
      font-size: 8pt;
      margin-bottom: 0.08in;
    }

    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
    }
  `;
}

function renderLabelBody(options: LabelExportOptions): string {
  const { content, layoutSettings, imageUrl } = options;
  const mode = layoutSettings.mode;

  const dmWarning =
    content.containsDmOnly && (content.dmOnlyBlockCount ?? 0) > 0
      ? `<div class="label-dm-warning">Enthält ${content.dmOnlyBlockCount} DM-only Element(e).</div>`
      : "";

  const imageSection =
    mode !== "text_only" && imageUrl
      ? `<div class="label-image-wrap"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(content.title)}" /></div>`
      : mode !== "text_only" && content.aiImagePlaceholder
        ? `<div class="label-image-wrap"><p class="label-text">${escapeHtml(content.aiImagePlaceholder)}</p></div>`
        : "";

  const textSection =
    mode !== "image_only" && content.text
      ? `<div class="label-text">${escapeHtml(content.text)}</div>`
      : mode !== "image_only" && content.aiTextPlaceholder
        ? `<div class="label-text">${escapeHtml(content.aiTextPlaceholder)}</div>`
        : "";

  return `
    ${dmWarning}
    <div class="label-body label-mode-${mode}">
      ${imageSection}
      ${textSection}
    </div>
  `;
}

export function renderLabelHtml(options: LabelExportOptions, printable = false): string {
  const styles = labelStyles(options.layoutSettings);
  const body = renderLabelBody(options);
  const printButton = printable
    ? `<div class="no-print" style="padding:1rem;text-align:center;">
         <button onclick="window.print()" style="padding:0.5rem 1rem;font-size:1rem;cursor:pointer;">Drucken</button>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)} — Label</title>
  <style>${styles}</style>
</head>
<body>
  ${printButton}
  <article class="label-page">
    <h1 class="label-title">${escapeHtml(options.content.title || options.title)}</h1>
    ${body}
    ${options.worldName ? `<footer class="label-footer">${escapeHtml(options.worldName)}</footer>` : ""}
  </article>
</body>
</html>`;
}

/** Minimal PDF generator for text labels (no external dependencies). */
export function renderLabelPdf(options: LabelExportOptions): Buffer {
  const textLines = (options.content.text || options.content.title || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const words = line.split(/\s+/);
      const wrapped: string[] = [];
      let current = "";

      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 70) {
          if (current) wrapped.push(current);
          current = word;
        } else {
          current = next;
        }
      }

      if (current) wrapped.push(current);
      return wrapped.length > 0 ? wrapped : [""];
    })
    .slice(0, 28);

  const w = options.layoutSettings.widthInches * 72;
  const h = options.layoutSettings.heightInches * 72;

  const escapePdf = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const contentStream = [
    "BT",
    "/F1 14 Tf",
    `50 ${h - 50} Td`,
    `(${escapePdf(options.content.title || options.title)}) Tj`,
    "/F1 10 Tf",
    "0 -24 Td",
    ...textLines.flatMap((line, index) => {
      if (index === 0) {
        return [`(${escapePdf(line)}) Tj`];
      }
      return ["0 -14 Td", `(${escapePdf(line)}) Tj`];
    }),
    "ET",
  ].join("\n");

  const streamLength = Buffer.byteLength(contentStream, "utf8");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

export function renderLabelExport(
  format: "html" | "pdf" | "print",
  options: LabelExportOptions,
): { body: Buffer | string; contentType: string; filename: string } {
  const safeTitle = options.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "label";

  if (format === "pdf") {
    if (options.layoutSettings.mode === "image_only" || options.imageUrl) {
      const html = renderLabelHtml(options, true);
      return {
        body: html,
        contentType: "text/html; charset=utf-8",
        filename: `${safeTitle}.print.html`,
      };
    }

    return {
      body: renderLabelPdf(options),
      contentType: "application/pdf",
      filename: `${safeTitle}.pdf`,
    };
  }

  const html = renderLabelHtml(options, format === "print");
  return {
    body: html,
    contentType: "text/html; charset=utf-8",
    filename: format === "print" ? `${safeTitle}.print.html` : `${safeTitle}.html`,
  };
}
