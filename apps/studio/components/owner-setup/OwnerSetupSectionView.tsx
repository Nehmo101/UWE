import Link from "next/link";
import type {
  SetupSectionStatus,
  SetupSettingItem,
  SetupSettingSource,
} from "@uwe/database/server";

function sourceBadgeClass(source: SetupSettingSource): string {
  if (source === "host-secret") return "uwe-badge uwe-badge-error";
  if (source === "db") return "uwe-badge uwe-badge-ok";
  return "uwe-badge";
}

function SourceBadge({ source }: { source: SetupSettingSource }) {
  const label =
    source === "db" ? "Datenbank" : source === "env" ? "Umgebung" : "Host-Secret";
  return <span className={sourceBadgeClass(source)}>{label}</span>;
}

function SettingRow({ item }: { item: SetupSettingItem }) {
  return (
    <tr>
      <td>
        <strong>{item.label}</strong>
        {item.hostSecretRequired && (
          <span className="uwe-badge uwe-badge-error" style={{ marginLeft: "0.5rem" }}>
            Host-Secret erforderlich
          </span>
        )}
        {item.description && (
          <p className="uwe-hint" style={{ margin: "0.25rem 0 0" }}>
            {item.description}
          </p>
        )}
      </td>
      <td>{item.configured ? "✓" : "—"}</td>
      <td>{item.displayValue}</td>
      <td>
        <SourceBadge source={item.source} />
      </td>
      <td>
        {item.href ? (
          <Link href={item.href} className="uwe-v2-btn uwe-v2-btn-ghost">
            Öffnen
          </Link>
        ) : item.editable ? (
          "Owner-Formular"
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

interface OwnerSetupSettingsTableProps {
  settings: SetupSettingItem[];
}

export function OwnerSetupSettingsTable({ settings }: OwnerSetupSettingsTableProps) {
  return (
    <div className="uwe-page-table-wrap">
      <table className="uwe-page-table">
        <thead>
          <tr>
            <th>Prüfpunkt</th>
            <th>Status</th>
            <th>Wert</th>
            <th>Quelle</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          {settings.map((item) => (
            <SettingRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface OwnerSetupSectionViewProps {
  section: SetupSectionStatus;
  children?: React.ReactNode;
}

export function OwnerSetupSectionView({ section, children }: OwnerSetupSectionViewProps) {
  return (
    <section className="uwe-v2-section">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <h2 className="uwe-v2-section-title">{section.title}</h2>
        <span className={`uwe-badge uwe-badge-${section.level === "ok" ? "ok" : section.level === "disabled" ? "muted" : "warn"}`}>
          {section.statusLabel}
        </span>
      </div>
      <p className="uwe-dashboard-muted">{section.message}</p>

      {section.nextSteps.length > 0 && (
        <div className="uwe-notice" style={{ marginTop: "0.75rem" }}>
          <strong>Nächste Schritte</strong>
          <ul className="uwe-inspector-findings">
            {section.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <OwnerSetupSettingsTable settings={section.settings} />
      </div>

      {children}
    </section>
  );
}
