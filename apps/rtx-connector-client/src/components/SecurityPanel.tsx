import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

type Props = {
  privacyMode: boolean;
  busy: boolean;
  onChangePrivacyMode: (value: boolean) => void;
  onSave: () => Promise<void> | void;
};

export function SecurityPanel({ privacyMode, busy, onChangePrivacyMode, onSave }: Props) {
  return (
    <div className="connector-grid connector-grid-2">
      <CardV2 title="Outbound-only Architektur">
        <div className="connector-stack">
          <HealthBadge status="ok" label="Nur ausgehende Verbindungen" />
          <ul className="connector-note-list">
            <li>Der Connector verbindet sich ausschließlich ausgehend zum UWE Host.</li>
            <li>Kein offener Port, kein SSH und kein HTTP-Server auf dem RTX-PC.</li>
            <li>Der Host verbindet sich niemals zurück zur RTX-Maschine.</li>
            <li>Es werden nur job-spezifische Daten empfangen — keine Welt-, Brain- oder Admin-Daten.</li>
            <li>Connector-Token wird lokal in AppData gespeichert und nie geloggt.</li>
          </ul>
        </div>
      </CardV2>

      <CardV2
        title="Privacy Mode"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="primary" onClick={() => void onSave()} disabled={busy}>
              Einstellungen speichern
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <label className="connector-checkbox">
            <input
              type="checkbox"
              checked={privacyMode}
              onChange={(event) => onChangePrivacyMode(event.target.checked)}
            />
            <span>Privacy Mode aktivieren</span>
          </label>
          <p className="connector-muted">
            Aktiviert minimale Metadaten an den Host: nur Connector-Name, Lanes und Modell-IDs
            werden gemeldet. Reichhaltige Telemetrie wie Modellbeschreibungen, Hardware-Details und
            Pfade auf der Festplatte bleiben lokal.
          </p>
          <p className="connector-muted">
            Wird beim Start als <code>UWE_CONNECTOR_PRIVACY_MODE</code> an den Connector-Prozess
            übergeben. Standard: aus.
          </p>
          <HealthBadge
            status={privacyMode ? "ok" : "degraded"}
            label={privacyMode ? "Privacy Mode aktiv" : "Privacy Mode aus"}
          />
        </div>
      </CardV2>
    </div>
  );
}
