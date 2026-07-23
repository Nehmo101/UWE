import { createMailAccountService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  createDraftAction,
  createMailAccountAction,
  updateDraftAction,
} from "../brain-actions";

export const dynamic = "force-dynamic";

function addrStr(value: unknown): string {
  return Array.isArray(value) ? value.filter((a) => typeof a === "string").join(", ") : "";
}

export default async function BrainMailPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/mail" title="Mail">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createMailAccountService(brainPrisma);
  const [accounts, inbox, drafts] = await Promise.all([
    service.listAccounts(),
    service.listInbox(undefined, 50),
    service.listDrafts(),
  ]);

  return (
    <BrainShell
      active="/mail"
      title="Mail-Center"
      lede={`${accounts.length} Konto/Konten · ${drafts.length} Entwurf/Entwürfe · ${inbox.length} Nachricht(en). Konten & Entwürfe verwalten, lokal auf deiner Hardware.`}
    >
      <section className="brain-section">
        <h2>Entwurf verfassen</h2>
        <form action={createDraftAction} className="brain-form brain-card">
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr" }}>
            <label>
              An (kommagetrennt)
              <input name="to" placeholder="name@beispiel.de, …" />
            </label>
            <label>
              Konto
              <select name="accountId" defaultValue="">
                <option value="">— ohne —</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Betreff
            <input name="subject" placeholder="Betreff" />
          </label>
          <label>
            Text
            <textarea name="bodyText" rows={4} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Entwurf speichern
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Entwürfe · {drafts.length}</h2>
        {drafts.length === 0 ? (
          <p className="brain-muted">Keine Entwürfe.</p>
        ) : (
          <ul className="brain-list">
            {drafts.map((draft) => (
              <li key={draft.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{draft.subject || "(kein Betreff)"}</strong>
                  <span className="brain-tag">{draft.status}</span>
                  <span className="brain-muted">{addrStr(draft.toAddresses) || "— kein Empfänger —"}</span>
                </div>
                <details className="brain-edit">
                  <summary>Bearbeiten</summary>
                  <form action={updateDraftAction} className="brain-form">
                    <input type="hidden" name="id" value={draft.id} />
                    <label>
                      An (kommagetrennt)
                      <input name="to" defaultValue={addrStr(draft.toAddresses)} />
                    </label>
                    <label>
                      Betreff
                      <input name="subject" defaultValue={draft.subject} />
                    </label>
                    <label>
                      Text
                      <textarea name="bodyText" rows={4} defaultValue={draft.bodyText ?? ""} />
                    </label>
                    <div>
                      <button type="submit" className="brain-btn brain-btn-sm">
                        Speichern
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="brain-section">
        <h2>Konten · {accounts.length}</h2>
        {accounts.length > 0 ? (
          <ul className="brain-list" style={{ marginBottom: "0.85rem" }}>
            {accounts.map((account) => (
              <li key={account.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{account.label}</strong>
                  {account.isDefault ? <span className="brain-tag">Standard</span> : null}
                  <span className="brain-muted">
                    {account.username} · {account.smtpHost}
                    {account.smtpPort ? `:${account.smtpPort}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <details className="brain-edit" style={{ marginTop: 0 }}>
          <summary>Konto hinzufügen</summary>
          <form action={createMailAccountAction} className="brain-form">
            <label>
              Bezeichnung
              <input name="label" required placeholder="z. B. Privat (GMX)" />
            </label>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr" }}>
              <label>
                SMTP-Host
                <input name="smtpHost" required placeholder="smtp.beispiel.de" />
              </label>
              <label>
                SMTP-Port
                <input name="smtpPort" type="number" placeholder="587" />
              </label>
            </div>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr" }}>
              <label>
                IMAP-Host
                <input name="imapHost" placeholder="imap.beispiel.de" />
              </label>
              <label>
                IMAP-Port
                <input name="imapPort" type="number" placeholder="993" />
              </label>
            </div>
            <label>
              Benutzername
              <input name="username" required placeholder="name@beispiel.de" autoComplete="off" />
            </label>
            <label>
              Passwort
              <input name="password" type="password" required autoComplete="new-password" />
            </label>
            <p className="brain-muted" style={{ margin: 0 }}>
              Das Passwort wird verschlüsselt lokal auf deiner Hardware gespeichert und nie an die Cloud übertragen.
            </p>
            <div>
              <button type="submit" className="brain-btn">
                Konto speichern
              </button>
            </div>
          </form>
        </details>
      </section>

      <section className="brain-section">
        <h2>Posteingang · {inbox.length}</h2>
        {inbox.length === 0 ? (
          <p className="brain-muted">Keine Nachrichten.</p>
        ) : (
          <ul className="brain-list">
            {inbox.map((message) => (
              <li key={message.id} className="brain-row">
                <strong>{message.subject || "(kein Betreff)"}</strong>
                <span className="brain-muted"> · {message.fromAddress}</span>
                {message.snippet ? (
                  <p style={{ margin: "0.35rem 0 0" }} className="brain-muted">
                    {message.snippet}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
