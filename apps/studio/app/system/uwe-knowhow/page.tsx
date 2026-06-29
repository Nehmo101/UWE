import { requireStudioAccess } from "@/src/lib/auth";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { KnowHowBrowser } from "@/src/components/system/KnowHowBrowser";
import { getKnowHowDocs } from "@/src/lib/uwe-knowhow";

export const dynamic = "force-dynamic";

export default async function SystemKnowHowPage() {
  await requireStudioAccess();
  const docs = getKnowHowDocs();

  return (
    <SystemShell breadcrumb={<span>System / UWE KnowHow</span>}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">UWE KnowHow</h1>
          <p className="text-sm text-muted-foreground">
            Durchsuchbare Systemhilfe aus der UWE-eigenen Dokumentation (README, CHANGELOG, docs/).
            Dies ist Systemhilfe — getrennt vom Welt-Brain. Aktualisierung erfolgt mit jedem
            Deploy/Neuladen aus den Doku-Quellen.
          </p>
        </header>
        <KnowHowBrowser docs={docs} />
      </div>
    </SystemShell>
  );
}
