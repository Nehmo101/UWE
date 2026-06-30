import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { getSecretsStatusSnapshot, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { formatStudioDateTime } from "@/src/lib/format";
import type {
  SecretItemStatus,
  SecretSource,
  SecretsStatusWarningSeverity,
} from "@uwe/database/server";

function statusLabel(status: SecretItemStatus): string {
  if (status === "set") return "gesetzt";
  if (status === "decrypt_failed") return "Entschlüsselung fehlgeschlagen";
  return "fehlt";
}

function sourceLabel(source: SecretSource): string {
  if (source === "env") return "ENV";
  if (source === "db-encrypted") return "DB verschlüsselt";
  return "DB gehasht";
}

function warningBadgeClass(severity: SecretsStatusWarningSeverity): string {
  if (severity === "critical") return "uwe-badge uwe-badge-danger";
  if (severity === "warning") return "uwe-badge uwe-badge-warning";
  return "uwe-badge";
}

export default async function AdminSecretsPage() {
  const snapshot = await getSecretsStatusSnapshot(prisma);
  const criticalWarnings = snapshot.warnings.filter((warning) => warning.severity === "critical");

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Einrichtung", href: "/admin/setup" },
            { label: "Secrets-Status" },
          ]}
        />
      }
    >
      <PageHeader
        title="Secrets-Status"
        summary="Read-only Übersicht bekannter Secrets — Quelle, Status und maskiertes Last-4. Kein Klartext, kein Vault."
        actions={
          <HealthBadge
            status={snapshot.ok ? "ok" : "error"}
            label={
              snapshot.ok
                ? "Keine kritischen Probleme"
                : `${criticalWarnings.length} kritisch`
            }
          />
        }
      />

      <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
        Stand: {formatStudioDateTime(new Date(snapshot.timestamp))} · Verschlüsselung über{" "}
        <code>{snapshot.encryptionKeyEnvKey}</code>
        {snapshot.encryptionKeyConfigured ? " (gesetzt)" : " (fehlt)"}
      </p>

      {snapshot.warnings.length > 0 && (
        <section className="uwe-v2-card" style={{ marginBottom: "1rem" }}>
          <h2 className="uwe-v2-section-title">Warnungen</h2>
          <ul className="uwe-dashboard-list">
            {snapshot.warnings.map((warning) => (
              <li key={warning.id}>
                <strong>{warning.title}</strong>{" "}
                <span className={warningBadgeClass(warning.severity)}>{warning.severity}</span>
                <p>{warning.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot.affectedByAuthSecretRotation.length > 0 && (
        <section className="uwe-form-error" role="alert" style={{ marginBottom: "1rem" }}>
          <strong>AUTH_SECRET-Rotation — betroffene Secrets neu eingeben:</strong>
          <ul className="uwe-inspector-findings">
            {snapshot.sections
              .flatMap((section) => section.items)
              .filter((item) => item.status === "decrypt_failed")
              .map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <Link href={item.href}>
                      <strong>{item.label}</strong>
                    </Link>
                  ) : (
                    <strong>{item.label}</strong>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      {snapshot.sections.map((section) => (
        <section key={section.id} className="uwe-v2-card" style={{ marginBottom: "1rem" }}>
          <h2 className="uwe-v2-section-title">{section.title}</h2>
          <p className="uwe-dashboard-muted">{section.description}</p>
          <div className="uwe-table-wrap" style={{ marginTop: "0.75rem" }}>
            <table className="uwe-table">
              <thead>
                <tr>
                  <th>Secret</th>
                  <th>Quelle</th>
                  <th>Status</th>
                  <th>Maskiert</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.label}</strong>
                      {item.description && (
                        <p className="uwe-dashboard-muted" style={{ margin: "0.25rem 0 0" }}>
                          {item.description}
                        </p>
                      )}
                      {item.envKey && (
                        <p className="uwe-dashboard-muted" style={{ margin: "0.25rem 0 0" }}>
                          <code>{item.envKey}</code>
                        </p>
                      )}
                    </td>
                    <td>{sourceLabel(item.source)}</td>
                    <td>{statusLabel(item.status)}</td>
                    <td>{item.maskedHint ?? (item.bootstrap ? "—" : "—")}</td>
                    <td>
                      {item.href ? (
                        <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={item.href}>
                          Konfigurieren
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="uwe-hint">
        Bootstrap-Secrets (<code>AUTH_SECRET</code>, <code>DATABASE_URL</code>,{" "}
        <code>STUDIO_API_TOKEN</code>) werden nur als ENV-Status angezeigt. Details:{" "}
        <Link href="/admin/setup">Einrichtung</Link> ·{" "}
        <Link href="/admin/security">Security Dashboard</Link>
      </p>
    </SystemShell>
  );
}
