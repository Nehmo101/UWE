import Link from "next/link";
import { createMailAccountService, getSystemSettings, prisma } from "@uwe/database/server";
import { createMailPortalService, type MailFolderKey } from "@uwe/mail/portal";
import { MAIL_PRIORITY_LABELS } from "@uwe/mail/portal-types";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  addMailAccountAction,
  archiveMailAction,
  deleteMailAccountAction,
  sendMailAction,
  syncMailAction,
} from "../brain-actions";

/**
 * Mail-Center — Abschnitt H10, Brain gewinnt.
 *
 * Gegenüber der bisherigen Brain-Fassung neu: die Ordner der Studio-Seite
 * (Posteingang, Markiert, Gesendet, Archiv, Papierkorb), die Volltextsuche und
 * die Prioritäten-Einstufung. Beides kommt aus `@uwe/mail/portal` — dieselbe
 * Quelle, die Studio benutzt hat.
 *
 * Die Vorlagen-Fassung (`/mail/compose?kind=session_recap` …) bleibt in Studio:
 * Session-Recap und Handout sind DM-Arbeit, kein Alltag.
 */

export const dynamic = "force-dynamic";

const FOLDERS: Array<{ key: MailFolderKey; label: string }> = [
  { key: "inbox", label: "Posteingang" },
  { key: "marked", label: "Markiert" },
  { key: "sent", label: "Gesendet" },
  { key: "archive", label: "Archiv" },
  { key: "trash", label: "Papierkorb" },
];

interface Props {
  searchParams: Promise<{ folder?: string; q?: string }>;
}

function parseFolder(value: string | undefined): MailFolderKey {
  return FOLDERS.some((entry) => entry.key === value) ? (value as MailFolderKey) : "inbox";
}

function folderHref(folder: MailFolderKey, query: string): string {
  const params = new URLSearchParams();
  if (folder !== "inbox") params.set("folder", folder);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/mail?${search}` : "/mail";
}

function formatWhen(value: Date): string {
  return new Date(value).toLocaleString("de-DE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BrainMailPage({ searchParams }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/mail" title="Mail">
        <BrainDenied />
      </BrainShell>
    );
  }

  const params = await searchParams;
  const folder = parseFolder(params.folder);
  const query = params.q?.trim() ?? "";

  const service = createMailAccountService(brainPrisma);
  const portal = createMailPortalService(brainPrisma);
  const settings = await getSystemSettings(prisma);
  const limit = settings.mail.inboxLimit;

  const [accounts, result, sent] = await Promise.all([
    service.listAccounts(),
    folder === "sent"
      ? Promise.resolve({ items: [], nextCursor: null })
      : portal.searchMessages({
          q: query || undefined,
          folder: folder === "marked" ? "marked" : folder,
          markedOnly: folder === "marked",
          limit,
        }),
    folder === "sent" ? portal.listSentMessages({ limit }) : Promise.resolve([]),
  ]);

  const inbox = folder === "sent" ? sent : result.items;
  const unread = inbox.filter((message) => !message.isRead).length;

  const syncAction = (
    <form action={syncMailAction}>
      <input type="hidden" name="accountId" value="all" />
      <button type="submit" className="brain-btn brain-btn-sm" disabled={accounts.length === 0}>
        ↻ Synchronisieren
      </button>
    </form>
  );

  return (
    <BrainShell
      active="/mail"
      title="Mail-Center"
      lede={`${accounts.length} Konto/Konten · ${inbox.length} Nachricht(en)${unread ? ` · ${unread} ungelesen` : ""} — echter Mail-Client (IMAP-Empfang, SMTP-Versand), lokal auf deiner Hardware.`}
      actions={syncAction}
    >
      <nav className="brain-form-row" aria-label="Ordner">
        {FOLDERS.map((entry) => (
          <Link
            key={entry.key}
            href={folderHref(entry.key, query)}
            aria-current={folder === entry.key ? "page" : undefined}
            className={
              folder === entry.key ? "brain-btn brain-btn-sm" : "brain-btn brain-btn-ghost brain-btn-sm"
            }
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <form method="get" action="/mail" className="brain-form-row" role="search">
        {folder === "inbox" ? null : <input type="hidden" name="folder" value={folder} />}
        <input name="q" defaultValue={query} placeholder="Betreff, Absender, Text …" />
        <button type="submit" className="brain-btn brain-btn-sm">
          Suchen
        </button>
        {query ? (
          <Link className="brain-btn brain-btn-ghost brain-btn-sm" href={folderHref(folder, "")}>
            Zurücksetzen
          </Link>
        ) : null}
      </form>
      {accounts.length === 0 ? (
        <p className="brain-muted" style={{ marginBottom: "1.25rem" }}>
          Noch kein Mail-Konto eingerichtet — füge unten eines hinzu, dann kannst du synchronisieren und senden.
        </p>
      ) : null}

      <section className="brain-section">
        <details className="brain-edit" style={{ marginTop: 0 }}>
          <summary>Neue Nachricht verfassen</summary>
          <form action={sendMailAction} className="brain-form">
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
              <label>
                Von (Konto)
                <select name="accountId" defaultValue={accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? ""} required>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label} · {account.username}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                An (kommagetrennt)
                <input name="to" required placeholder="name@beispiel.de, …" />
              </label>
            </div>
            <label>
              CC (optional)
              <input name="cc" placeholder="kopie@beispiel.de" />
            </label>
            <label>
              Betreff
              <input name="subject" placeholder="Betreff" />
            </label>
            <label>
              Text
              <textarea name="bodyText" rows={6} />
            </label>
            <div>
              <button type="submit" className="brain-btn" disabled={accounts.length === 0}>
                Senden
              </button>
            </div>
          </form>
        </details>
      </section>

      <section className="brain-section">
        <h2>
          {FOLDERS.find((entry) => entry.key === folder)?.label} · {inbox.length}
          {query ? ` · Suche „${query}"` : ""}
        </h2>
        {inbox.length === 0 ? (
          <p className="brain-muted">
            {query
              ? "Nichts gefunden."
              : "Keine Nachrichten. Klicke oben auf Synchronisieren, um dein Postfach abzurufen."}
          </p>
        ) : (
          <ul className="brain-list">
            {inbox.map((message) => (
              <li key={message.id} className="brain-row" style={message.isRead ? undefined : { borderColor: "var(--uwe-accent)" }}>
                <div className="brain-row-head">
                  <Link href={`/mail/${message.id}`} style={{ fontWeight: message.isRead ? 400 : 700 }}>
                    {message.subject || "(kein Betreff)"}
                  </Link>
                  {message.isRead ? null : <span className="brain-tag">neu</span>}
                  {message.priority?.category ? (
                    <span className="brain-tag">
                      {MAIL_PRIORITY_LABELS[message.priority.category] ?? message.priority.category}
                    </span>
                  ) : null}
                  <span className="brain-muted">
                    {message.fromAddress} · {formatWhen(message.receivedAt)}
                  </span>
                  <form action={archiveMailAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={message.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Archivieren
                    </button>
                  </form>
                </div>
                {message.snippet ? (
                  <Link href={`/mail/${message.id}`} className="brain-muted" style={{ display: "block", marginTop: "0.3rem", textDecoration: "none" }}>
                    {message.snippet}
                  </Link>
                ) : null}
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
                    {account.username} · SMTP {account.smtpHost}
                    {account.imapHost ? ` · IMAP ${account.imapHost}` : " · kein IMAP"}
                    {account.imapSyncError ? " · ⚠ Sync-Fehler" : ""}
                  </span>
                  <span className="brain-head-actions" style={{ marginLeft: "auto" }}>
                    <form action={syncMailAction}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                        ↻ Sync
                      </button>
                    </form>
                    <form action={deleteMailAccountAction}>
                      <input type="hidden" name="id" value={account.id} />
                      <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <details className="brain-edit" style={{ marginTop: 0 }}>
          <summary>Konto hinzufügen</summary>
          <form action={addMailAccountAction} className="brain-form">
            <label>
              Bezeichnung
              <input name="label" required placeholder="z. B. Privat (GMX)" />
            </label>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr" }}>
              <label>
                SMTP-Host
                <input name="smtpHost" required placeholder="mail.gmx.net" />
              </label>
              <label>
                SMTP-Port
                <input name="smtpPort" type="number" placeholder="587" />
              </label>
            </div>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr" }}>
              <label>
                IMAP-Host (für Empfang)
                <input name="imapHost" placeholder="imap.gmx.net" />
              </label>
              <label>
                IMAP-Port
                <input name="imapPort" type="number" placeholder="993" />
              </label>
            </div>
            <label>
              Benutzername / E-Mail
              <input name="username" required placeholder="name@gmx.de" autoComplete="off" />
            </label>
            <label>
              Passwort
              <input name="password" type="password" required autoComplete="new-password" />
            </label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
              <input name="isDefault" type="checkbox" style={{ width: "auto" }} />
              Als Standard-Konto
            </label>
            <p className="brain-muted" style={{ margin: 0 }}>
              Das Passwort wird verschlüsselt lokal gespeichert (nie in die Cloud). Bei Anbietern mit 2FA ist meist ein
              App-Passwort nötig.
            </p>
            <div>
              <button type="submit" className="brain-btn">
                Konto speichern
              </button>
            </div>
          </form>
        </details>
      </section>
    </BrainShell>
  );
}
