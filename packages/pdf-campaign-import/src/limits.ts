/**
 * Größenlimit für Kampagnen-PDF-Uploads. Große Abenteuerbände sind meist
 * bildlastig; der Upload läuft deshalb über die API-Route auf die Festplatte
 * statt als Base64 durch eine Server Action.
 */
export const MAX_CAMPAIGN_PDF_BYTES = 300 * 1024 * 1024;
