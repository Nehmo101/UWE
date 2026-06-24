"use client";

import { useState } from "react";
import {
  createShareLinkAction,
  disableShareLinkAction,
  updateShareLinkAction,
} from "@/app/share-actions";
import { getShareLinkPublicUrl } from "@/src/lib/share-url";
import { formatStudioDateOrDash } from "@/src/lib/format";

interface ShareLinkRecord {
  id: string;
  token: string;
  enabled: boolean;
  expiresAt: string | null;
  readOnly: boolean;
  logAccess: boolean;
  hasPassword: boolean;
  createdAt: string;
}

interface ShareLinkPanelProps {
  worldId: string;
  worldSlug: string;
  targetType: "page" | "handout" | "asset";
  targetId: string;
  returnPath: string;
  links: ShareLinkRecord[];
  previewHref?: string;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ShareLinkPanel({
  worldId,
  worldSlug,
  targetType,
  targetId,
  returnPath,
  links,
  previewHref,
}: ShareLinkPanelProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(getShareLinkPublicUrl(token));
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <section className="share-link-panel">
      <h3>Freigabe-Link</h3>

      <form action={createShareLinkAction} className="uwe-form share-link-form">
        <input type="hidden" name="worldId" value={worldId} />
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnPath" value={returnPath} />

        <label>
          Ablaufdatum (optional)
          <input type="datetime-local" name="expiresAt" />
        </label>

        <label>
          Passwort (optional)
          <input type="password" name="password" autoComplete="new-password" />
        </label>

        <label className="uwe-checkbox">
          <input type="checkbox" name="readOnly" defaultChecked />
          Nur-Lesen-Link
        </label>

        <label className="uwe-checkbox">
          <input type="checkbox" name="logAccess" />
          Zugriff protokollieren
        </label>

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Link erstellen
        </button>
      </form>

      {previewHref && (
        <p className="share-link-preview">
          <a href={previewHref} target="_blank" rel="noreferrer" className="uwe-v2-btn uwe-v2-btn-ghost">
            Vorschau anzeigen
          </a>
        </p>
      )}

      {links.length > 0 && (
        <ul className="share-link-list">
          {links.map((link) => (
            <li key={link.id} className={link.enabled ? "" : "share-link-disabled"}>
              <div className="share-link-meta">
                <code>{getShareLinkPublicUrl(link.token)}</code>
                <span>
                  {link.enabled ? "Aktiv" : "Deaktiviert"} · Erstellt {formatStudioDateOrDash(link.createdAt)}
                </span>
                <span>
                  Ablauf: {formatStudioDateOrDash(link.expiresAt)} · {link.hasPassword ? "Passwort" : "Kein Passwort"} ·{" "}
                  {link.readOnly ? "Nur-Lesen" : "Bearbeitbar"} ·{" "}
                  {link.logAccess ? "Protokoll an" : "Protokoll aus"}
                </span>
              </div>

              <div className="share-link-actions">
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-ghost"
                  onClick={() => copyLink(link.token)}
                >
                  {copiedToken === link.token ? "Kopiert!" : "Link kopieren"}
                </button>

                {link.enabled && (
                  <form action={disableShareLinkAction}>
                    <input type="hidden" name="linkId" value={link.id} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
                      Deaktivieren
                    </button>
                  </form>
                )}

                <form action={updateShareLinkAction} className="share-link-update-form">
                  <input type="hidden" name="linkId" value={link.id} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <label>
                    Ablaufdatum
                    <input
                      type="datetime-local"
                      name="expiresAt"
                      defaultValue={toDateTimeLocal(link.expiresAt)}
                    />
                  </label>
                  <label>
                    Neues Passwort
                    <input type="password" name="password" autoComplete="new-password" />
                  </label>
                  {link.hasPassword && (
                    <label className="uwe-checkbox">
                      <input type="checkbox" name="clearPassword" />
                      Passwort entfernen
                    </label>
                  )}
                  <label className="uwe-checkbox">
                    <input type="checkbox" name="readOnly" defaultChecked={link.readOnly} />
                    Nur-Lesen
                  </label>
                  <label className="uwe-checkbox">
                    <input type="checkbox" name="logAccess" defaultChecked={link.logAccess} />
                    Zugriff protokollieren
                  </label>
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost">
                    Einstellungen speichern
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
