import type { MailConfigStatus } from "@uwe/mail";
import Link from "next/link";

interface MailCenterSetupProps {
  smtpStatus: MailConfigStatus;
  accountCount: number;
}

export function MailCenterSetup({ smtpStatus, accountCount }: MailCenterSetupProps) {
  return (
    <div className="uwe-mail-center-setup">
      <section className="uwe-v2-card">
        <h2 className="uwe-v2-section-title">Einrichtung — Odysseus-Stil</h2>
        <p className="uwe-hint">
          Outbound (SMTP) und Inbound (IMAP) getrennt konfigurieren. Secrets nur serverseitig —
          nie im Browser.
        </p>
        <ol className="uwe-linked-list">
          <li>
            <Link href="/settings?tab=mail">SMTP unter Einstellungen → Mail</Link> — Versand für
            Session-Recaps, Handouts und Systemwarnungen.
          </li>
          <li>
            <Link href="/admin/mail">Mail Portal</Link> — IMAP-Konten (Gmail/Outlook/Generic),
            Smart Inbox, KI-Entwürfe.
          </li>
          <li>
            <Link href="/mail/compose?kind=backup_warning">Test-Compose</Link> — Entwurf prüfen
            bevor Versand.
          </li>
        </ol>
      </section>

      <section className="uwe-v2-card" style={{ marginTop: "1.5rem" }}>
        <h3>SMTP-Status</h3>
        <dl className="uwe-kv-list">
          <div>
            <dt>Konfiguriert</dt>
            <dd>{smtpStatus.configured ? "Ja" : "Nein"}</dd>
          </div>
          <div>
            <dt>Host</dt>
            <dd>{smtpStatus.host ?? "—"}</dd>
          </div>
          <div>
            <dt>Diagnose</dt>
            <dd>{smtpStatus.message}</dd>
          </div>
        </dl>
        <p>
          <Link href="/settings?tab=mail" className="uwe-v2-btn uwe-v2-btn-secondary">
            SMTP konfigurieren
          </Link>
        </p>
      </section>

      <section className="uwe-v2-card" style={{ marginTop: "1.5rem" }}>
        <h3>IMAP-Konten</h3>
        <p className="uwe-dashboard-muted">
          {accountCount === 0
            ? "Noch keine Konten — im Mail Portal anlegen."
            : `${accountCount} Konto/Konten aktiv.`}
        </p>
        <p>
          <Link href="/admin/mail" className="uwe-v2-btn uwe-v2-btn-primary">
            Mail Portal öffnen
          </Link>
        </p>
      </section>
    </div>
  );
}
