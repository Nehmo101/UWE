import { Suspense } from "react";
import { PortalShell } from "@/src/components/shell";
import { PageHeader } from "@/src/components/shell";
import { TableModeClient } from "@/src/components/table-mode/TableModeClient";

/**
 * Tischmodus — der Spieltisch-Blick, der ohne Netz auskommt.
 *
 * Diese Seite liefert **absichtlich keine Inhalte vom Server**: nur die Hülle.
 * Der Service Worker legt genau diese Hülle in den Cache, damit sie ohne
 * Verbindung noch lädt — stünden hier Nutzerdaten drin, lägen sie damit auch
 * im Cache eines Geräts, das herumgereicht wird. Die Inhalte kommen aus dem
 * lokalen Speicher des Browsers (`offline-store.ts`).
 *
 * Bewusst welt-unabhängig: eine Hülle für alle Welten statt einer pro Slug —
 * sonst müsste der Cache jede Welt einzeln kennen.
 */

export const dynamic = "force-dynamic";

export default function PortalTableModePage() {
  return (
    <PortalShell brandLabel="Tischmodus">
      <PageHeader
        title="Tischmodus"
        summary="Charakterbogen, Notizen und Gruppen-Inventar — auch ohne Netz. Notizen, die hier entstehen, werden übertragen, sobald wieder Verbindung besteht."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Lädt …</p>}>
        <TableModeClient />
      </Suspense>
    </PortalShell>
  );
}
