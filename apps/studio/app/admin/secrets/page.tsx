import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import { HealthBadge } from "@uwe/shared-ui";
import { getSecretsStatusSnapshot, logAuditEvent, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import {
  Alert,
  Badge,
  type BadgeProps,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui";
import { formatStudioDateTime } from "@/src/lib/format";
import { getCurrentAuthUser } from "@/src/lib/auth";
import type {
  SecretItemStatus,
  SecretSource,
  SecretsStatusItem,
  SecretsStatusSection,
  SecretsStatusWarningSeverity,
} from "@uwe/database/server";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

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

function warningBadgeVariant(severity: SecretsStatusWarningSeverity): BadgeProps["variant"] {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
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
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p>{section.description}</p>
        <p>{sectionSummary(section.items)}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={TH_CLASS}>Secret</th>
              <th className={TH_CLASS}>Quelle</th>
              <th className={TH_CLASS}>Status</th>
              <th className={TH_CLASS}>Maskiert</th>
              <th className={TH_CLASS}>Aktualisiert</th>
              <th className={TH_CLASS}>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {section.items.map((item) => (
              <tr key={item.id}>
                <td className={TD_CLASS}>
                  <strong>{item.label}</strong>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  )}
                  {item.envKey && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <code>{item.envKey}</code>
                    </p>
                  )}
                </td>
                <td className={TD_CLASS}>{sourceLabel(item.source)}</td>
                <td className={TD_CLASS}>
                  <HealthBadge status={statusBadgeStatus(item.status)} label={statusLabel(item.status)} />
                  {rotationDueIds.has(item.id) ? (
                    <p className="mt-1 text-sm text-muted-foreground">Rotation empfohlen</p>
                  ) : null}
                </td>
                <td className={TD_CLASS}>{item.maskedHint ?? (item.bootstrap ? "nur ENV" : "—")}</td>
                <td className={TD_CLASS}>
                  {item.updatedAt ? formatStudioDateTime(new Date(item.updatedAt)) : "—"}
                </td>
                <td className={TD_CLASS}>
                  {item.href ? (
                    <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href={item.href}>
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
      <details
        className="mb-4 rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm"
        open={defaultOpen}
      >
        {/* TODO(design-kit): Card hat kein natives <details>-Äquivalent; Radix Collapsible wäre die kit-konforme Lösung für aufklappbare Sections. */}
        <summary className="cursor-pointer list-none font-semibold leading-none tracking-tight">
          {section.title}
        </summary>
        <div className="mt-3">{content}</div>
      </details>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

export default async function AdminSecretsPage() {
  const user = await getCurrentAuthUser();
  const snapshot = await getSecretsStatusSnapshot(prisma, brainPrisma);
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
            <Link className={buttonVariants({ variant: "secondary" })} href="/admin/security">
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

      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Stand: {formatStudioDateTime(new Date(snapshot.timestamp))} · Verschlüsselung über{" "}
          <code>{snapshot.encryptionKeyEnvKey}</code>
          {snapshot.encryptionKeyConfigured ? " (gesetzt)" : " (fehlt)"}
        </p>

        {snapshot.warnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Warnungen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {snapshot.warnings.map((warning) => (
                  <li key={warning.id}>
                    <strong>{warning.title}</strong>{" "}
                    <Badge variant={warningBadgeVariant(warning.severity)}>{warning.severity}</Badge>
                    <p className="mt-1">{warning.description}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {snapshot.affectedByAuthSecretRotation.length > 0 && (
          <Alert tone="danger" role="alert" title="AUTH_SECRET-Rotation — betroffene Secrets neu eingeben:">
            <ul className="list-disc space-y-1 pl-5">
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
          </Alert>
        )}

        {snapshot.sections.map((section) => (
          <SecretsSectionTable key={section.id} section={section} rotationDueIds={rotationDueIds} />
        ))}

        <p className="text-sm text-muted-foreground">
          Bootstrap-Secrets (<code>AUTH_SECRET</code>, <code>DATABASE_URL</code>,{" "}
          <code>STUDIO_API_TOKEN</code>) werden nur als ENV-Status angezeigt. Zugriffe werden im{" "}
          <Link href="/admin/audit-log">Audit-Log</Link> protokolliert. Details:{" "}
          <Link href="/admin/setup">Einrichtung</Link> ·{" "}
          <Link href="/admin/security">Security Dashboard</Link>
        </p>
      </div>
    </SystemShell>
  );
}
