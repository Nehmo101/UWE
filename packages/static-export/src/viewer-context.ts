import { buildPlayerViewContext, type AccessContext } from "@uwe/auth";

/**
 * Der statische Export ist die Spielersicht in Dateiform. Er wird deshalb wie
 * für ein Weltmitglied ohne Studio-Häkchen gebaut: `filterPagesForViewer`
 * lässt nur freigegebene Seiten durch, `:::dm`-Bereiche fallen aus dem Inhalt.
 *
 * Der Nutzer ist synthetisch — es geht nicht darum, WER exportiert (das ist
 * immer ein DM), sondern was die Dateien zeigen dürfen, wenn sie den Server
 * verlassen haben.
 */
export function staticExportViewerContext(worldId: string): AccessContext {
  return buildPlayerViewContext(worldId);
}
