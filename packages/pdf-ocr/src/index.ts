/**
 * `@uwe/pdf-ocr` — layout-treues PDF-Parsing über lokales Unlimited-OCR.
 *
 * Reines Package: rendert, plant und räumt auf. Der eigentliche Modellaufruf
 * läuft über den bestehenden `vision_extract`-Connector-Job und bleibt beim
 * Aufrufer (Studio-Action), damit hier weder Prisma noch der AI-Router hängen.
 */
export * from "./markers";
export * from "./model";
export * from "./plan";
export * from "./render";
export * from "./text-layer";
