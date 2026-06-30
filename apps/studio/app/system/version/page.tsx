import Link from "next/link";
import { requireStudioAccess } from "@/src/lib/auth";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { BuildVersionFooter } from "@/src/components/system/BuildVersion";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getBuildInfo } from "@/src/lib/build-info";

export const dynamic = "force-dynamic";

const FALLBACK = "unbekannt (lokal/Dev)";

export default async function SystemVersionPage() {
  await requireStudioAccess();
  const info = getBuildInfo();

  const rows: { label: string; value: string }[] = [
    { label: "Version", value: info.version },
    { label: "Commit", value: info.commit ?? FALLBACK },
    { label: "Branch", value: info.branch ?? FALLBACK },
    { label: "Gebaut am", value: info.builtAt ?? FALLBACK },
    { label: "Deploy-Run", value: info.deployRunNumber ?? FALLBACK },
  ];

  return (
    <SystemShell
      breadcrumb={<span>System / Version &amp; Updates</span>}
      footer={<BuildVersionFooter info={info} />}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Version &amp; Updates</h1>
          <p className="text-sm text-muted-foreground">
            Aktuelle Build- und Deploy-Metadaten dieser UWE-Instanz.{" "}
            <Link href="/system/whats-new" className="text-primary hover:underline">
              Was ist neu →
            </Link>
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Build-Metadaten</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
              {rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-mono break-all">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Commit, Branch, Build-Zeit und Deploy-Run werden vom Deploy-Pipeline über die
          Umgebungsvariablen <code>UWE_COMMIT</code>, <code>UWE_BRANCH</code>,{" "}
          <code>UWE_BUILT_AT</code> und <code>UWE_DEPLOY_RUN_NUMBER</code> gesetzt
          (GitHub Actions liefert <code>GITHUB_SHA</code>, <code>GITHUB_REF_NAME</code> und{" "}
          <code>GITHUB_RUN_NUMBER</code> als Fallback).
        </p>
      </div>
    </SystemShell>
  );
}
