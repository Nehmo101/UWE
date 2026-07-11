import { buildRoleCapabilityMatrix, ROLE_CAPABILITY_LABELS } from "@uwe/auth";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";
import { groupCapabilityRows } from "@/src/lib/role-capability-groups";
import { Alert } from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

const GLOBAL_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  dm: "DM",
  player: "Spieler",
  readonly: "Readonly",
  guest: "Gast",
};

const WORLD_ROLE_LABELS: Record<string, string> = {
  owner: "Welt-Owner",
  dm: "DM",
  co_dm: "Co-DM",
  player: "Spieler",
};

function CapabilityTable({
  title,
  roles,
  roleLabels,
  groups,
}: {
  title: string;
  roles: string[];
  roleLabels: Record<string, string>;
  groups: ReturnType<typeof groupCapabilityRows>;
}) {
  return (
    <section className="mb-6 flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {groups.map((group) => (
        <details
          key={group.id}
          className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
          open={group.id === "system"}
        >
          {/* TODO(design-kit): Card hat kein natives <details>-Äquivalent; Radix Collapsible wäre die kit-konforme Lösung für aufklappbare Sections. */}
          <summary className="cursor-pointer list-none font-semibold leading-none tracking-tight">
            {group.title} ({group.rows.length})
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={TH_CLASS}>Capability</th>
                  {roles.map((role) => (
                    <th key={role} className={TH_CLASS}>
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.capability}>
                    <td className={TD_CLASS}>{row.label}</td>
                    {roles.map((role) => (
                      <td key={role} className={TD_CLASS}>
                        {title.includes("Globale")
                          ? row.global[role as keyof typeof row.global]
                            ? "✓"
                            : "—"
                          : row.world[role as keyof typeof row.world]
                            ? "✓"
                            : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}

export default async function AdminRolesPage() {
  await requireAdminAccess();
  const matrix = buildRoleCapabilityMatrix();
  const groups = groupCapabilityRows(matrix);
  const globalRoles = Object.keys(GLOBAL_ROLE_LABELS);
  const worldRoles = Object.keys(WORLD_ROLE_LABELS);

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Rollen & Rechte" }]}
        />
      }
    >
      <PageHeader
        title="Rollen & Rechte"
        summary="Read-only Matrix der feingranularen Capabilities — gruppiert nach Bereich. Co-DM nutzt Proposal-Workflow statt direkter Kanon-Edits."
      />

      <Alert tone="info" className="mb-4">
        Diese Übersicht ist schreibgeschützt. Benutzer-Rollen änderst du unter{" "}
        <a href="/admin/users">Benutzer & Rollen</a>.
      </Alert>

      <CapabilityTable
        title="Globale Studio-Rollen"
        roles={globalRoles}
        roleLabels={GLOBAL_ROLE_LABELS}
        groups={groups}
      />

      <CapabilityTable
        title="Welt-Mitgliedschaft"
        roles={worldRoles}
        roleLabels={WORLD_ROLE_LABELS}
        groups={groups}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Capability-Referenz</h2>
        <dl className="grid gap-2.5">
          {Object.entries(ROLE_CAPABILITY_LABELS).map(([key, label]) => (
            <div key={key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
              <dt className="font-semibold text-muted-foreground">{label}</dt>
              <dd className="break-words">
                <code>{key}</code>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </SystemShell>
  );
}
