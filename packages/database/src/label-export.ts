import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { LabelContentData, LabelLayoutSettings } from "./label-service";
import {
  ensureLabelElements,
  LABEL_CANVAS_HEIGHT,
  LABEL_CANVAS_WIDTH,
  LABEL_SAFE_MARGIN,
  type LabelElement,
} from "./label-elements";

const LABEL_PDF_WIN_ANSI: Record<string, string> = {
  "\u00e4": "\xE4",
  "\u00f6": "\xF6",
  "\u00fc": "\xFC",
  "\u00c4": "\xC4",
  "\u00d6": "\xD6",
  "\u00dc": "\xDC",
  "\u00df": "\xDF",
  "\u20ac": "\x80",
};

/** Standard PDF fonts only support WinAnsi; map common German chars, replace the rest. */
export function sanitizeLabelPdfText(text: string): string {
  return [...text]
    .map((char) => {
      const mapped = LABEL_PDF_WIN_ANSI[char];
      if (mapped) {
        return mapped;
      }
      const code = char.codePointAt(0) ?? 0;
      return code >= 0x20 && code <= 0xff ? char : "?";
    })
    .join("");
}

export interface LabelExportOptions {
  content: LabelContentData;
  layoutSettings: LabelLayoutSettings;
  title: string;
  imageUrl?: string | null;
  imageUrls?: Record<string, string>;
  worldName?: string;
  includeDmOnly?: boolean;
}

export interface LabelExportRenderOptions {
  showSafeArea?: boolean;
  showCropMarks?: boolean;
  printFriendly?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function elementToCss(element: LabelElement, imageUrls: Record<string, string>): string {
  const style = element.style ?? {};
  const base = `
    position: absolute;
    left: ${element.x}in;
    top: ${element.y}in;
    width: ${element.width}in;
    height: ${element.height}in;
    z-index: ${element.zIndex};
    opacity: ${element.visible ? (style.opacity ?? 1) : 0};
    pointer-events: none;
  `;

  if (element.type === "divider") {
    return `<div class="label-el label-el-divider" style="${base} border-top: ${style.borderWidth ?? 1}px solid ${style.borderColor ?? "#999"};"></div>`;
  }

  if (element.type === "box") {
    return `<div class="label-el label-el-box" style="${base}
      background: ${style.backgroundColor ?? "transparent"};
      border: ${style.borderWidth ?? 1}px solid ${style.borderColor ?? "#ccc"};
      border-radius: ${style.borderRadius ?? 0}px;
    "></div>`;
  }

  if (element.type === "image") {
    const url = element.imageAssetId ? imageUrls[element.imageAssetId] : null;
    if (!url) {
      return `<div class="label-el label-el-image label-el-empty" style="${base} display:flex;align-items:center;justify-content:center;border:1px dashed #ccc;font-size:8pt;color:#999;">Kein Bild</div>`;
    }
    const focusX = style.cropFocusX ?? 50;
    const focusY = style.cropFocusY ?? 50;
    const zoom = style.cropZoom ?? 100;
    const objectPosition = `${focusX}% ${focusY}%`;
    const objectFit = zoom > 100 ? "cover" : "contain";
    const transform = zoom > 100 ? `scale(${zoom / 100})` : "none";
    return `<div class="label-el label-el-image" style="${base} overflow:hidden;">
      <img src="${escapeHtml(url)}" alt="${escapeHtml(element.imageAlt ?? "")}" style="width:100%;height:100%;object-fit:${objectFit};object-position:${objectPosition};transform:${transform};transform-origin:${objectPosition};" />
    </div>`;
  }

  if (element.type === "qr" && element.url) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(element.url)}`;
    return `<div class="label-el label-el-qr" style="${base}">
      <img src="${escapeHtml(qrUrl)}" alt="QR Code" style="width:100%;height:100%;object-fit:contain;" />
    </div>`;
  }

  if (element.type === "title" || element.type === "text" || element.type === "icon") {
    const fontSize = style.fontSize ?? (element.type === "title" ? 14 : 10);
    return `<div class="label-el label-el-${element.type}" style="${base}
      font-size: ${fontSize}pt;
      font-weight: ${style.fontWeight ?? (element.type === "title" ? "bold" : "normal")};
      font-style: ${style.fontStyle ?? "normal"};
      text-align: ${style.textAlign ?? "left"};
      line-height: ${style.lineHeight ?? 1.35};
      color: ${style.color ?? "#111"};
      overflow: hidden;
      white-space: pre-wrap;
    ">${escapeHtml(element.text ?? "")}</div>`;
  }

  return "";
}

function labelStyles(settings: LabelLayoutSettings, renderOpts: LabelExportRenderOptions): string {
  const w = settings.widthInches;
  const h = settings.heightInches;
  const margin = LABEL_SAFE_MARGIN;

  return `
    @page {
      size: ${w}in ${h}in;
      margin: 0;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: #111;
      background: ${renderOpts.printFriendly ? "#fff" : "#f8fafc"};
    }

    .label-page {
      width: ${w}in;
      height: ${h}in;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      background: #fff;
      margin: 0 auto;
    }

    .label-safe-area {
      position: absolute;
      left: ${margin}in;
      top: ${margin}in;
      width: ${w - margin * 2}in;
      height: ${h - margin * 2}in;
      border: 1px dashed rgba(148, 163, 184, 0.6);
      pointer-events: none;
      z-index: 0;
    }

    .label-crop-marks::before {
      content: "";
      position: absolute;
      inset: -0.12in;
      pointer-events: none;
      background:
        linear-gradient(#94a3b8, #94a3b8) left top / 0.12in 1px no-repeat,
        linear-gradient(#94a3b8, #94a3b8) left top / 1px 0.12in no-repeat,
        linear-gradient(#94a3b8, #94a3b8) right top / 0.12in 1px no-repeat,
        linear-gradient(#94a3b8, #94a3b8) right top / 1px 0.12in no-repeat,
        linear-gradient(#94a3b8, #94a3b8) left bottom / 0.12in 1px no-repeat,
        linear-gradient(#94a3b8, #94a3b8) left bottom / 1px 0.12in no-repeat,
        linear-gradient(#94a3b8, #94a3b8) right bottom / 0.12in 1px no-repeat,
        linear-gradient(#94a3b8, #94a3b8) right bottom / 1px 0.12in no-repeat;
    }

    .label-elements {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .label-footer {
      position: absolute;
      bottom: 0.08in;
      left: ${margin}in;
      right: ${margin}in;
      font-size: 7pt;
      color: #666;
      z-index: 100;
    }

    .label-dm-warning {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: #fef3c7;
      border-bottom: 1px solid #f59e0b;
      color: #92400e;
      padding: 0.06in 0.1in;
      font-size: 7pt;
      z-index: 200;
    }

    @media print {
      body { background: #fff; }
      .no-print { display: none !important; }
      .label-safe-area { border-color: transparent; }
    }
  `;
}

function renderElementsHtml(
  options: LabelExportOptions,
  renderOpts: LabelExportRenderOptions,
): string {
  const elements = ensureLabelElements(options.content, options.layoutSettings);
  const imageUrls = options.imageUrls ?? {};
  if (options.imageUrl && options.content.imageAssetId) {
    imageUrls[options.content.imageAssetId] = options.imageUrl;
  }

  const visibleElements = elements
    .filter((el) => el.visible && (!el.dmOnly || options.includeDmOnly))
    .sort((a, b) => a.zIndex - b.zIndex);

  const safeArea = renderOpts.showSafeArea
    ? `<div class="label-safe-area"></div>`
    : "";

  const dmWarning =
    options.content.containsDmOnly && (options.content.dmOnlyBlockCount ?? 0) > 0
      ? `<div class="label-dm-warning">Enthält ${options.content.dmOnlyBlockCount} DM-only Element(e).</div>`
      : "";

  const cropClass = renderOpts.showCropMarks ? " label-crop-marks" : "";

  return `
    <article class="label-page${cropClass}">
      ${dmWarning}
      ${safeArea}
      <div class="label-elements">
        ${visibleElements.map((el) => elementToCss(el, imageUrls)).join("\n")}
      </div>
      ${options.worldName ? `<footer class="label-footer">${escapeHtml(options.worldName)}</footer>` : ""}
    </article>
  `;
}

/** Legacy body renderer for labels without visual elements */
function renderLegacyBody(options: LabelExportOptions): string {
  const { content, layoutSettings, imageUrl } = options;
  const mode = layoutSettings.mode;

  const dmWarning =
    content.containsDmOnly && (content.dmOnlyBlockCount ?? 0) > 0
      ? `<div class="label-dm-warning">Enthält ${content.dmOnlyBlockCount} DM-only Element(e).</div>`
      : "";

  const imageSection =
    mode !== "text_only" && imageUrl
      ? `<div class="label-image-wrap" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(content.title)}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`
      : "";

  const textSection =
    mode !== "image_only" && content.text
      ? `<div class="label-text" style="font-size:10pt;line-height:1.35;white-space:pre-wrap;overflow:hidden;">${escapeHtml(content.text)}</div>`
      : "";

  return `
    ${dmWarning}
    <h1 style="font-size:14pt;font-weight:700;margin:0 0 0.12in;">${escapeHtml(content.title || options.title)}</h1>
    <div style="flex:1;display:flex;flex-direction:column;gap:0.1in;min-height:0;">
      ${imageSection}
      ${textSection}
    </div>
  `;
}

export function renderLabelHtml(
  options: LabelExportOptions,
  printable = false,
  renderOpts?: LabelExportRenderOptions,
): string {
  const settings = options.layoutSettings;
  const opts: LabelExportRenderOptions = {
    showSafeArea: renderOpts?.showSafeArea ?? settings.showSafeArea ?? true,
    showCropMarks: renderOpts?.showCropMarks ?? settings.showCropMarks ?? false,
    printFriendly: renderOpts?.printFriendly ?? settings.printFriendly ?? true,
  };

  const styles = labelStyles(settings, opts);
  const useVisual =
    options.content.editorMode === "visual" ||
    (options.content.elements && options.content.elements.length > 0);

  const body = useVisual
    ? renderElementsHtml(options, opts)
    : `<article class="label-page" style="padding:0.2in;display:flex;flex-direction:column;">${renderLegacyBody(options)}${options.worldName ? `<footer class="label-footer">${escapeHtml(options.worldName)}</footer>` : ""}</article>`;

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
  ${body}
</body>
</html>`;
}

export function renderMultiLabelHtml(
  labels: LabelExportOptions[],
  printable = false,
): string {
  if (labels.length === 0) {
    return renderLabelHtml(
      {
        content: { title: "Leer", text: "" },
        layoutSettings: {
          mode: "text_only",
          truncateToPage: true,
          truncateLongWords: true,
          widthInches: LABEL_CANVAS_WIDTH,
          heightInches: LABEL_CANVAS_HEIGHT,
        },
        title: "Leer",
      },
      printable,
    );
  }

  const settings = labels[0]!.layoutSettings;
  const opts: LabelExportRenderOptions = {
    showSafeArea: settings.showSafeArea ?? true,
    showCropMarks: settings.showCropMarks ?? false,
    printFriendly: settings.printFriendly ?? true,
  };

  const styles = labelStyles(settings, opts);
  const bodies = labels
    .map((label) => {
      const useVisual =
        label.content.editorMode === "visual" ||
        (label.content.elements && label.content.elements.length > 0);
      return useVisual
        ? renderElementsHtml(label, opts)
        : `<article class="label-page" style="padding:0.2in;display:flex;flex-direction:column;">${renderLegacyBody(label)}</article>`;
    })
    .join("\n");

  const printButton = printable
    ? `<div class="no-print" style="padding:1rem;text-align:center;">
         <button onclick="window.print()" style="padding:0.5rem 1rem;font-size:1rem;cursor:pointer;">Drucken</button>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Druckliste — ${labels.length} Labels</title>
  <style>${styles}</style>
</head>
<body>
  ${printButton}
  ${bodies}
</body>
</html>`;
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1];
      if (!base64) return null;
      return Uint8Array.from(Buffer.from(base64, "base64"));
    }

    if (url.startsWith("file:") || url.startsWith("/")) {
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export async function renderLabelPdfAsync(
  options: LabelExportOptions,
  imageBytes?: Uint8Array | null,
): Promise<Buffer> {
  const w = options.layoutSettings.widthInches * 72;
  const h = options.layoutSettings.heightInches * 72;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([w, h]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const elements = ensureLabelElements(options.content, options.layoutSettings);
  const imageUrls = options.imageUrls ?? {};

  for (const element of elements.filter((el) => el.visible && (!el.dmOnly || options.includeDmOnly))) {
    const x = element.x * 72;
    const y = h - element.y * 72 - element.height * 72;
    const elW = element.width * 72;
    const elH = element.height * 72;
    const style = element.style ?? {};

    if (element.type === "box") {
      page.drawRectangle({
        x,
        y,
        width: elW,
        height: elH,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: style.borderWidth ?? 1,
      });
    }

    if (element.type === "divider") {
      page.drawLine({
        start: { x, y: y + elH / 2 },
        end: { x: x + elW, y: y + elH / 2 },
        thickness: style.borderWidth ?? 1,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    if ((element.type === "title" || element.type === "text") && element.text) {
      const fontSize = style.fontSize ?? (element.type === "title" ? 14 : 10);
      const useFont = style.fontWeight === "bold" ? fontBold : font;
      const lines = element.text.split(/\r?\n/).slice(0, Math.floor(elH / (fontSize * 1.4)));

      let lineY = y + elH - fontSize;
      for (const line of lines) {
        if (lineY < y) break;
        page.drawText(sanitizeLabelPdfText(line).slice(0, 120), {
          x: x + 2,
          y: lineY,
          size: fontSize,
          font: useFont,
          maxWidth: elW - 4,
        });
        lineY -= fontSize * (style.lineHeight ?? 1.35);
      }
    }

    if (element.type === "image" && element.imageAssetId) {
      const url = imageUrls[element.imageAssetId];
      let bytes = imageBytes;

      if (!bytes && url) {
        bytes = await fetchImageBytes(url);
      }

      if (bytes) {
        try {
          let image;
          if (bytes[0] === 0xff && bytes[1] === 0xd8) {
            image = await pdfDoc.embedJpg(bytes);
          } else {
            image = await pdfDoc.embedPng(bytes);
          }
          page.drawImage(image, { x, y, width: elW, height: elH });
        } catch {
          page.drawText("[Bild nicht einbettbar]", {
            x: x + 4,
            y: y + elH / 2,
            size: 8,
            font,
          });
        }
      }
    }
  }

  if (elements.length === 0 || !options.content.elements?.length) {
    const title = options.content.title || options.title;
    page.drawText(title.slice(0, 80), { x: 36, y: h - 50, size: 14, font: fontBold });
    const textLines = (options.content.text || "").split(/\r?\n/).slice(0, 20);
    let ty = h - 74;
    for (const line of textLines) {
      page.drawText(line.slice(0, 90), { x: 36, y: ty, size: 10, font });
      ty -= 14;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/** Minimal PDF generator for text labels (sync fallback, no images). */
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

export async function renderMultiLabelPdfAsync(
  labels: LabelExportOptions[],
): Promise<Buffer> {
  if (labels.length === 0) {
    return renderLabelPdf({
      content: { title: "Leer", text: "" },
      layoutSettings: {
        mode: "text_only",
        truncateToPage: true,
        truncateLongWords: true,
        widthInches: LABEL_CANVAS_WIDTH,
        heightInches: LABEL_CANVAS_HEIGHT,
      },
      title: "Leer",
    });
  }

  const w = labels[0]!.layoutSettings.widthInches * 72;
  const h = labels[0]!.layoutSettings.heightInches * 72;
  const pdfDoc = await PDFDocument.create();

  for (const label of labels) {
    const singlePdf = await renderLabelPdfAsync(label);
    const loaded = await PDFDocument.load(singlePdf);
    const pages = await pdfDoc.copyPages(loaded, loaded.getPageIndices());
    for (const p of pages) {
      pdfDoc.addPage(p);
    }
  }

  if (pdfDoc.getPageCount() === 0) {
    pdfDoc.addPage([w, h]);
  }

  return Buffer.from(await pdfDoc.save());
}

export interface LabelExportResult {
  body: Buffer | string;
  contentType: string;
  filename: string;
  fallback?: boolean;
  fallbackReason?: string;
}

function elementToSvg(
  element: LabelElement,
  imageUrls: Record<string, string>,
  scale: number,
): string {
  const x = element.x * scale;
  const y = element.y * scale;
  const w = element.width * scale;
  const h = element.height * scale;
  const style = element.style ?? {};

  if (element.type === "box") {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${style.backgroundColor ?? "none"}" stroke="${style.borderColor ?? "#ccc"}" stroke-width="${style.borderWidth ?? 1}" />`;
  }

  if (element.type === "divider") {
    return `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${style.borderColor ?? "#999"}" stroke-width="${style.borderWidth ?? 1}" />`;
  }

  if (element.type === "title" || element.type === "text") {
    const fontSize = (style.fontSize ?? (element.type === "title" ? 14 : 10)) * (scale / 96);
    const weight = style.fontWeight === "bold" ? "bold" : "normal";
    const anchor =
      style.textAlign === "center" ? "middle" : style.textAlign === "right" ? "end" : "start";
    const textX =
      style.textAlign === "center" ? x + w / 2 : style.textAlign === "right" ? x + w : x;
    const lines = (element.text ?? "").split(/\r?\n/).slice(0, 20);
    return lines
      .map(
        (line, index) =>
          `<text x="${textX}" y="${y + fontSize + index * fontSize * (style.lineHeight ?? 1.35)}" font-size="${fontSize}" font-weight="${weight}" fill="${style.color ?? "#111"}" text-anchor="${anchor}">${escapeHtml(line)}</text>`,
      )
      .join("");
  }

  if (element.type === "image" && element.imageAssetId && imageUrls[element.imageAssetId]) {
    return `<image href="${escapeHtml(imageUrls[element.imageAssetId]!)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" />`;
  }

  return "";
}

export function renderLabelSvg(
  options: LabelExportOptions,
  dpi = 150,
): string {
  const w = options.layoutSettings.widthInches * dpi;
  const h = options.layoutSettings.heightInches * dpi;
  const elements = ensureLabelElements(options.content, options.layoutSettings);
  const imageUrls = { ...(options.imageUrls ?? {}) };
  if (options.imageUrl && options.content.imageAssetId) {
    imageUrls[options.content.imageAssetId] = options.imageUrl;
  }

  const body = elements
    .filter((el) => el.visible && (!el.dmOnly || options.includeDmOnly))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((el) => elementToSvg(el, imageUrls, dpi))
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${body}
</svg>`;
}

export async function renderLabelExportAsync(
  format: "html" | "pdf" | "print",
  options: LabelExportOptions,
): Promise<LabelExportResult> {
  const safeTitle = options.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "label";

  if (format === "pdf") {
    try {
      const pdf = await renderLabelPdfAsync(options);
      return {
        body: pdf,
        contentType: "application/pdf",
        filename: `${safeTitle}.pdf`,
      };
    } catch (error) {
      const html = renderLabelHtml(options, true);
      return {
        body: html,
        contentType: "text/html; charset=utf-8",
        filename: `${safeTitle}.print.html`,
        fallback: true,
        fallbackReason:
          error instanceof Error ? error.message : "PDF-Generierung fehlgeschlagen",
      };
    }
  }

  const html = renderLabelHtml(options, format === "print");
  return {
    body: html,
    contentType: "text/html; charset=utf-8",
    filename: format === "print" ? `${safeTitle}.print.html` : `${safeTitle}.html`,
  };
}

export function renderLabelExport(
  format: "html" | "pdf" | "print",
  options: LabelExportOptions,
): LabelExportResult {
  const safeTitle = options.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "label";

  if (format === "pdf") {
    const hasImage =
      options.layoutSettings.mode === "image_only" ||
      !!options.imageUrl ||
      !!options.content.imageAssetId ||
      (options.content.elements?.some(
        (el) => el.visible && el.type === "image" && el.imageAssetId,
      ) ?? false);

    if (hasImage) {
      return {
        body: renderLabelHtml(options, true),
        contentType: "text/html; charset=utf-8",
        filename: `${safeTitle}.print.html`,
        fallback: true,
        fallbackReason: "Nutzen Sie den async PDF-Export für Layout mit Bildern.",
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
