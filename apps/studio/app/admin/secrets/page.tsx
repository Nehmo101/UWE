import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { getSecretsStatusSnapshot, logAuditEvent, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { formatStudioDateTime } from "@/src/lib/format";
import { getCurrentAuthUser } from "@/src/lib/auth";
import type {
  SecretItemStatus,
  SecretSource,
  SecretsStatusItem,
  SecretsStatusSection,
  SecretsStatusWarningSeverity,
} from "@uwe/database/server";

function statusLabel(status: SecretItemStatus): string {
  if (status === "set") return "gesetzt";
  if (status === "decrypt_failed") return "Entschlüsselung fehlgeschlagen";
  return "fehlt";
}

function statusBadgeStatus(status: SecretItemStatus): "ok" | "degraded" | "error" {
  if (status === "set") return "ok";
  if (status === "decrypt_failed") return "error";
  return "degraded";
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

function sectionSummary(items: SecretsStatusItem[]): string {
  const setCount = items.filter((item) => item.status === "set").length;
  const missingCount = items.filter((item) => item.status === "missing").length;
  const failedCount = items.filter((item) => item.status === "decrypt_failed").length;
  const parts = [`${setCount} gesetzt`, `${missingCount} fehlen`];
  if (failedCount > 0) {
    parts.push(`${failedCount} Entschlüsselung fehlgeschlagen`);
  }
  return parts.join(" · ");
}

function SecretsSectionTable({
  section,
  rotationDueIds,
}: {
  section: SecretsStatusSection;
  rotationDueIds: Set<string>;
}) {
  const hasIssues = section.items.some(
    (item) => item.status === "missing" || item.status === "decrypt_failed",
  );
  const defaultOpen = section.id !== "host-env" || hasIssues;

  const content = (
    <>
      <p className="uwe-dashboard-muted">{section.description}</p>
      <p className="uwe-dashboard-muted" style={{ marginTop: "0.35rem" }}>
        {sectionSummary(section.items)}
      </p>
      <div className="uwe-table-wrap" style={{ marginTop: "0.75rem" }}>
        <table className="uwe-table">
          <thead>
            <tr>
              <th>Secret</th>
              <th>Quelle</th>
              <th>Status</th>
              <th>Maskiert</th>
              <th>Aktualisiert</th>
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
                <td>
                  <HealthBadge status={statusBadgeStatus(item.status)} label={statusLabel(item.status)} />
                  {rotationDueIds.has(item.id) ? (
                    <p className="uwe-dashboard-muted" style={{ margin: "0.25rem 0 0" }}>
                      Rotation empfohlen
                    </p>
                  ) : null}
                </td>
                <td>{item.maskedHint ?? (item.bootstrap ? "nur ENV" : "—")}</td>
                <td>{item.updatedAt ? formatStudioDateTime(new Date(item.updatedAt)) : "—"}</td>
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
    </>
  );

  if (section.id === "host-env") {
    return (
      <details className="uwe-v2-card" style={{ marginBottom: "1rem" }} open={defaultOpen}>
        <summary className="uwe-v2-section-title" style={{ cursor: "pointer", listStyle: "none" }}>
          {section.title}
        </summary>
        <div style={{ marginTop: "0.75rem" }}>{content}</div>
      </details>
    );
  }

  return (
    <section className="uwe-v2-card" style={{ marginBottom: "1rem" }}>
      <h2 className="uwe-v2-section-title">{section.title}</h2>
      {content}
    </section>
  );
}

export default async function AdminSecretsPage() {
  const user = await getCurrentAuthUser();
  const snapshot = await getSecretsStatusSnapshot(prisma);
  const criticalWarnings = snapshot.warnings.filter((warning) => warning.severity === "critical");
  const rotationDueIds = new Set(snapshot.rotationDueSecretIds);

  if (user) {
    await logAuditEvent(prisma, {
      actorUserId: user.id,
      action: "secret_status_viewed",
      targetType: "settings",
      targetId: "secrets-status",
      metadata: {
        authMethod: "session",
        rotationDueCount: snapshot.rotationDueSecretIds.length,
        criticalWarnings: criticalWarnings.length,
      },
    });
  }

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
          <>
            <Link className="uwe-v2-btn" href="/admin/security">
              Security Dashboard
            </Link>
            <HealthBadge
              status={snapshot.ok ? "ok" : "error"}
              label={
                snapshot.ok
                  ? "Keine kritischen Probleme"
                  : `${criticalWarnings.length} kritisch`
              }
            />
          </>
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
        <SecretsSectionTable key={section.id} section={section} rotationDueIds={rotationDueIds} />
      ))}

      <p className="uwe-hint">
        Bootstrap-Secrets (<code>AUTH_SECRET</code>, <code>DATABASE_URL</code>,{" "}
        <code>STUDIO_API_TOKEN</code>) werden nur als ENV-Status angezeigt. Zugriffe werden im{" "}
        <Link href="/admin/audit-log">Audit-Log</Link> protokolliert. Details:{" "}
        <Link href="/admin/setup">Einrichtung</Link> ·{" "}
        <Link href="/admin/security">Security Dashboard</Link>
      </p>
    </SystemShell>
  );
}
