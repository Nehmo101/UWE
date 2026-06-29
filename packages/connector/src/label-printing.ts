/**
 * Shared label-printing types and helpers for UWE Host ↔ RTX Connector.
 */

export const LABEL_PRINT_FORMATS = ["pdf", "html"] as const;
export type LabelPrintFormat = (typeof LABEL_PRINT_FORMATS)[number];

export interface LocalPrinterInfo {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  state?: string;
}

export interface LabelPrintJobPayload {
  printerId: string;
  printerName?: string;
  format: LabelPrintFormat;
  title: string;
  worldSlug?: string;
  printListId?: string;
  includeDmOnly?: boolean;
}

export interface PrinterDiscoverResult {
  printers: LocalPrinterInfo[];
}

const FORMAT_SET = new Set<string>(LABEL_PRINT_FORMATS);

export function isLabelPrintFormat(value: unknown): value is LabelPrintFormat {
  return typeof value === "string" && FORMAT_SET.has(value);
}

export function labelPrintDocumentPath(jobId: string): string {
  return `/api/connectors/print-jobs/${encodeURIComponent(jobId)}/document`;
}

export function normalizeLocalPrinters(value: unknown): LocalPrinterInfo[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const printers: LocalPrinterInfo[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry == null) continue;
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    printers.push({
      id,
      name,
      description: typeof raw.description === "string" ? raw.description : undefined,
      isDefault: raw.isDefault === true,
      state: typeof raw.state === "string" ? raw.state : undefined,
    });
  }
  return printers;
}

export function parseLabelPrintJobPayload(payload: unknown): LabelPrintJobPayload | null {
  if (typeof payload !== "object" || payload == null) return null;
  const raw = payload as Record<string, unknown>;
  const printerId = typeof raw.printerId === "string" ? raw.printerId.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const format = isLabelPrintFormat(raw.format) ? raw.format : "pdf";
  if (!printerId || !title) return null;
  return {
    printerId,
    printerName: typeof raw.printerName === "string" ? raw.printerName : undefined,
    format,
    title,
    worldSlug: typeof raw.worldSlug === "string" ? raw.worldSlug : undefined,
    printListId: typeof raw.printListId === "string" ? raw.printListId : undefined,
    includeDmOnly: raw.includeDmOnly === true,
  };
}
