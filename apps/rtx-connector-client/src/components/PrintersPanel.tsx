/**
 * Drucker panel — shows configured printers and print command info.
 * Configuration is via environment variables on the RTX host
 * (not in the desktop client itself).
 */
export function PrintersPanel() {
  return (
    <div className="connector-stack">
      <div className="connector-empty-state">
        <p className="connector-lead">Drucker-Verwaltung</p>
        <p>
          Konfiguriere lokale Drucker auf dem RTX-Host über{" "}
          <code>UWE_CONNECTOR_PRINTERS</code> in{" "}
          <code>tools/uwe-rtx-connector/.env</code>.
        </p>
        <p className="connector-muted">
          Ohne diese Variable erkennt der Host-Connector Drucker automatisch
          über CUPS (<code>lpstat -p</code>).
        </p>
      </div>

      <div className="connector-panel">
        <h3>Beispiel-Konfiguration (.env auf dem RTX-Host)</h3>
        <pre className="connector-code">{`# Einzelner Drucker (Zebra LP 2844 via CUPS):
UWE_CONNECTOR_PRINTERS=[{"id":"zebra-lp2844","name":"Zebra LP 2844 Label"}]

# Mehrere Drucker:
# UWE_CONNECTOR_PRINTERS=[{"id":"zebra-lp2844","name":"Zebra LP 2844"},{"id":"hp-lj","name":"HP LaserJet"}]

# Eigener Druckbefehl (optional, Standard: CUPS lp -d <id> <file>):
# UWE_CONNECTOR_PRINT_CMD=lpr -P

# Label-Druck deaktivieren:
# UWE_CONNECTOR_PRINT=false`}</pre>
      </div>

      <div className="connector-panel">
        <h3>CUPS-Integration (Linux / macOS)</h3>
        <ol className="connector-steps">
          <li>
            CUPS installieren:{" "}
            <code>sudo apt install cups</code> (Debian/Ubuntu)
          </li>
          <li>
            Drucker in der CUPS-Weboberfläche einrichten:{" "}
            <code>http://localhost:631</code>
          </li>
          <li>
            Prüfen: <code>lpstat -p</code> — der Connector erkennt Drucker automatisch
          </li>
        </ol>
        <p className="connector-muted">
          Auf Windows: <code>UWE_CONNECTOR_PRINT_CMD</code> auf ein Script zeigen
          lassen, das den Windows-Druckspooler aufruft.
        </p>
      </div>
    </div>
  );
}
