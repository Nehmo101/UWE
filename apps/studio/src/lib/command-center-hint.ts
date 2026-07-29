/**
 * Wo die Systemkonfiguration seit Abschnitt D33 wohnt.
 *
 * Studios `/settings` trägt nur noch Design und Startseite; Portal, Welten, KI,
 * Mail, Image Studio, Speicher, Backup, Briefing, Privatsphäre, Anmeldung und
 * Notfallmodus laufen über die Kommandozentrale auf dem Host.
 *
 * Der Grund für diese Datei: Nach dem Umzug zeigten mehrere Hinweise weiter auf
 * `/settings?tab=…`. Diese Tabs gibt es nicht mehr — die Links landeten
 * kommentarlos auf der Design-Seite, und wer den Schalter suchte, fand nichts.
 * Ein Wegweiser an einer Stelle statt derselbe Satz an fünf.
 */

/** Menüpfad in der Kommandozentrale bis zur Einstellungen-Maske. */
export const COMMAND_CENTER_SETTINGS_PATH = "Kommandozentrale → Betrieb → Einstellungen";

/**
 * Satz für ein Feature, das in der Kommandozentrale eingeschaltet wird.
 * `group` ist die Überschrift der Gruppe in der Einstellungen-Maske
 * (siehe `SETTINGS_GROUPS` in der Kommandozentrale), z. B. „Anmeldung".
 */
export function commandCenterHint(group: string): string {
  return `Einzustellen in der Kommandozentrale auf dem UWE-Host: ${COMMAND_CENTER_SETTINGS_PATH} → ${group}.`;
}
