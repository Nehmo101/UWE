/**
 * `@uwe/scan-inbox` — Dokumentenscanner / Scan Inbox.
 *
 * Pipeline: Upload → OCR (PDF-Layer oder Maschinenraum-Vision) → Feld-Extraktion →
 * Ablage-Vorschlag → Owner bestätigt → Ablage. Nie automatisch. Private Scans
 * laufen Maschinenraum-lokal (Connector-Queue), nie über Cloud.
 */
export * from "./scan-types";
export * from "./field-extraction";
export * from "./kind-detection";
export * from "./proposal-builder";
export * from "./analyze";
export * from "./parse-recipe";
export * from "./scan-service";
