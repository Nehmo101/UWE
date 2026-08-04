import { Suspense } from "react";
import { PortalShell } from "@/src/components/shell";
import { PageHeader } from "@/src/components/shell";
import { TableModeClient } from "@/src/components/table-mode/TableModeClient";
import { getCurrentUser } from "@/src/lib/auth";

/**
 * Tischmodus — der Spieltisch-Blick, der ohne Netz auskommt.
 *
 * Diese Seite liefert **absichtlich keine Inhalte vom Server**: nur die Hülle
 * plus die `userId` der angemeldeten Person. Die Kennung ist kein Inhalt —
 * sie ist das Schloss, an dem der lokale Speicher hängt: `offline-store.ts`
 * verwirft und löscht jeden Abzug, der einem anderen Konto gehört. Der
 * Service Worker legt die Hülle in den Cache, damit sie ohne Verbindung noch
 * lädt; die Inhalte kommen aus dem lokalen Speicher des Browsers.
 *
 * Bewusst welt-unabhängig: eine Hülle für alle Welten statt einer pro Slug —
 * sonst müsste der Cache jede Welt einzeln kennen.
 */

export const dynamic = "force-dynamic";

export default async function PortalTableModePage() {
  const user = await getCurrentUser();

  return (
    <PortalShell brandLabel="Tischmodus">
      <PageHeader
        title="Tischmodus"
        summary="Charakterbogen, Notizen und Gruppen-Inventar — auch ohne Netz. Notizen, die hier entstehen, werden übertragen, sobald wieder Verbindung besteht."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Lädt …</p>}>
        <TableModeClient viewerUserId={user?.id ?? null} />
      </Suspense>
    </PortalShell>
  );
}
