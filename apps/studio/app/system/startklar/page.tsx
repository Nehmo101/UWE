import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStudioAccess } from "@/src/lib/auth";
import { assertStudioTrusted } from "@/src/lib/authz";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { BuildVersionFooter } from "@/src/components/system/BuildVersion";
import { ReleaseNotes } from "@/src/components/system/ReleaseNotes";
import { getBuildInfo } from "@/src/lib/build-info";
import { getStartklarData, markStartklarSeen } from "@/src/lib/startklar";

export const dynamic = "force-dynamic";

async function markSeenAction() {
  "use server";
  assertStudioTrusted();
  await markStartklarSeen();
  revalidatePath("/system/startklar");
}

export default async function SystemStartklarPage() {
  await requireStudioAccess();
  const info = getBuildInfo();
  const data = await getStartklarData();

  const hasEnvIssues = data.envIssues.length > 0;
  const hasMigrationWork = !data.migration.ok || data.migration.pending.length > 0;

  return (
    <SystemShell
      breadcrumb={<span>System / Startklar</span>}
      footer={<BuildVersionFooter info={info} />}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Startklar nach dem Update</h1>
          <p className="text-sm text-muted-foreground">
            Was hat sich geändert, was musst du tun? Installierte Version{" "}
            <strong>v{data.currentVersion}</strong>
            {data.seenVersion ? (
              <> · zuletzt bestätigt v{data.seenVersion}</>
            ) : (
              <> · noch nicht bestätigt</>
            )}
            .
          </p>
          {!data.isUpToDate ? (
            <form action={markSeenAction}>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Als gelesen markieren (v{data.currentVersion})
              </button>
            </form>
          ) : (
            <p className="text-sm" style={{ color: "var(--uwe-success, green)" }}>
              ✓ Du bist auf dem aktuellen Stand.
            </p>
          )}
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Nötige Env-Änderungen</h2>
          {hasEnvIssues ? (
            <ul className="flex flex-col gap-1 text-sm">
              {data.envIssues.map((issue) => (
                <li key={issue.id}>
                  <strong>{issue.severity === "error" ? "Fehler" : "Warnung"}:</strong>{" "}
                  {issue.message}
                  {issue.envKey ? <code> ({issue.envKey})</code> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              ✓ Keine Umgebungsprobleme erkannt.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Abhängigkeiten</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {data.dependencies.map((service) => (
              <li key={service.id} className="flex flex-wrap items-baseline gap-2">
                <span aria-hidden>{service.ok ? "✓" : service.severity === "warn" ? "⚠" : "✗"}</span>
                <strong>{service.label}:</strong>
                <span className="text-muted-foreground">{service.message}</span>
                {service.id === "portal" ? (
                  <Link href="/system/health" className="text-primary hover:underline">
                    Health →
                  </Link>
                ) : null}
                {service.id === "rtx_connector" || service.id === "ollama" ? (
                  <Link href="/system/rtx-connector" className="text-primary hover:underline">
                    RTX →
                  </Link>
                ) : null}
                {service.id === "cloudflare_tunnel" ? (
                  <Link href="/system/cloudflare" className="text-primary hover:underline">
                    Cloudflare →
                  </Link>
                ) : null}
                {service.id === "backup" ? (
                  <Link href="/backup" className="text-primary hover:underline">
                    Backup →
                  </Link>
                ) : null}
                {service.id === "database" ? (
                  <Link href="/admin/migrations" className="text-primary hover:underline">
                    Migrationen →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Migrationsstatus</h2>
          {hasMigrationWork ? (
            <div className="text-sm">
              <p>{data.migration.message}</p>
              {data.migration.pending.length > 0 ? (
                <p>
                  Offen: {data.migration.pending.join(", ")} —{" "}
                  <Link href="/admin/migrations" className="text-primary hover:underline">
                    Migration Inspector →
                  </Link>
                </p>
              ) : null}
              {data.migration.failed.length > 0 ? (
                <p>Fehlgeschlagen: {data.migration.failed.join(", ")}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              ✓ Alle Migrationen angewendet.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Backup</h2>
          {data.backup.recommended ? (
            <ul className="flex flex-col gap-1 text-sm">
              {data.backup.actions.map((action) => (
                <li key={action.id}>
                  {action.title} — {action.description}{" "}
                  <Link href="/backup" className="text-primary hover:underline">
                    Zum Backup →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              ✓ Backup aktuell — kein Handlungsbedarf.
            </p>
          )}
        </section>

        {data.otherActions.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Neue Admin-Aufgaben</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {data.otherActions.map((action) => (
                <li key={action.id}>
                  {action.title} — {action.description}
                  {action.href ? (
                    <>
                      {" "}
                      <Link href={action.href} className="text-primary hover:underline">
                        Öffnen →
                      </Link>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Was hat sich geändert</h2>
          {data.newReleases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine neuen Release Notes seit deiner letzten Bestätigung.{" "}
              <Link href="/system/whats-new" className="text-primary hover:underline">
                Alle Notes →
              </Link>
            </p>
          ) : (
            <ReleaseNotes releases={data.newReleases} currentVersion={data.currentVersion} />
          )}
        </section>
      </div>
    </SystemShell>
  );
}
