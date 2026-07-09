import { buildRoleCapabilityMatrix, ROLE_CAPABILITY_LABELS } from "@uwe/auth";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";
import { groupCapabilityRows } from "@/src/lib/role-capability-groups";

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
    <section className="uwe-v2-section">
      <h2 className="uwe-v2-section-title">{title}</h2>
      {groups.map((group) => (
        <details key={group.id} className="uwe-v2-card uwe-v2-section" open={group.id === "system"}>
          <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: "0.5rem" }}>
            {group.title} ({group.rows.length})
          </summary>
          <div style={{ overflowX: "auto" }}>
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  {roles.map((role) => (
                    <th key={role}>{roleLabels[role]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.capability}>
                    <td>{row.label}</td>
                    {roles.map((role) => (
                      <td key={role}>
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

      <p className="uwe-notice" style={{ marginBottom: "1rem" }}>
        Diese Übersicht ist schreibgeschützt. Benutzer-Rollen änderst du unter{" "}
        <a href="/admin/users">Benutzer & Rollen</a>.
      </p>

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

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Capability-Referenz</h2>
        <dl className="uwe-dl">
          {Object.entries(ROLE_CAPABILITY_LABELS).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                <code>{key}</code>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </SystemShell>
  );
}
