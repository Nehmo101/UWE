import Link from "next/link";

export function SettingsStatusTab() {
  return (
    <section className="uwe-form">
      <h2>Systemstatus</h2>
      <p>
        Vollständige Diagnose für UWE, Datenbank, Storage, Cloudflare, Auth, Mail, Brain,
        RTX-Inference, Embeddings und Jobs — ohne Secrets.
      </p>
      <p style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
        <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/system?tab=diagnose">
          System-Diagnose
        </Link>
        <Link className="uwe-v2-btn" href="/system">
          System-Hub
        </Link>
        <Link className="uwe-v2-btn" href="/system/rtx-connector">
          RTX Connector
        </Link>
        <Link className="uwe-v2-btn" href="/ai">
          KI
        </Link>
      </p>
    </section>
  );
}
