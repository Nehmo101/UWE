import Link from "next/link";
import { requireStudioAccess } from "@/src/lib/auth";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { BuildVersionFooter } from "@/src/components/system/BuildVersion";
import { ReleaseNotes } from "@/src/components/system/ReleaseNotes";
import { getBuildInfo } from "@/src/lib/build-info";
import { getChangelogReleases } from "@/src/lib/changelog";

export const dynamic = "force-dynamic";

export default async function SystemWhatsNewPage() {
  await requireStudioAccess();
  const info = getBuildInfo();
  const releases = getChangelogReleases();

  return (
    <SystemShell
      breadcrumb={<span>System / Was ist neu</span>}
      footer={<BuildVersionFooter info={info} />}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Was ist neu</h1>
          <p className="text-sm text-muted-foreground">
            Release Notes aus{" "}
            <code>CHANGELOG.md</code> im Repository-Root — nach einem Update siehst du hier, was sich
            geändert hat. Installierte Version: <strong>v{info.version}</strong>.
            {" · "}
            <Link href="/system/version" className="text-primary hover:underline">
              Build-Metadaten →
            </Link>
          </p>
        </header>

        <ReleaseNotes releases={releases} currentVersion={info.version} />
      </div>
    </SystemShell>
  );
}
