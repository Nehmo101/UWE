import { buildRoleCapabilityMatrix, ROLE_CAPABILITY_LABELS } from "@uwe/auth";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";

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

export default async function AdminRolesPage() {
  await requireAdminAccess();
  const matrix = buildRoleCapabilityMatrix();
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
        summary="Read-only Matrix der feingranularen Capabilities — globale Studio-Rollen und Welt-Mitgliedschaften (D10)."
      />

      <p className="uwe-notice" style={{ marginBottom: "1rem" }}>
        Diese Übersicht ist schreibgeschützt. Benutzer-Rollen änderst du unter{" "}
        <a href="/admin/users">Benutzer & Rollen</a>. Co-DM nutzt Proposal-Workflow statt
        direkter Kanon-Edits.
      </p>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Globale Studio-Rollen</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Capability</th>
                {globalRoles.map((role) => (
                  <th key={role}>{GLOBAL_ROLE_LABELS[role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.capability}>
                  <td>{row.label}</td>
                  {globalRoles.map((role) => (
                    <td key={role}>{row.global[role as keyof typeof row.global] ? "✓" : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Welt-Mitgliedschaft</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Capability</th>
                {worldRoles.map((role) => (
                  <th key={role}>{WORLD_ROLE_LABELS[role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={`world-${row.capability}`}>
                  <td>{row.label}</td>
                  {worldRoles.map((role) => (
                    <td key={role}>{row.world[role as keyof typeof row.world] ? "✓" : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
