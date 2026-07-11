"use client";

import { useState } from "react";
import {
  createShareLinkAction,
  disableShareLinkAction,
  updateShareLinkAction,
} from "@/app/share-actions";
import { getShareLinkPublicUrl } from "@/src/lib/share-url";
import { formatStudioDateOrDash } from "@/src/lib/format";
import { Badge, Button, buttonVariants, Input, Label, cn } from "@/src/components/ui";

/** Kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind. TODO(design-kit). */
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

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
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Freigabe-Link</h3>

      <form action={createShareLinkAction} className="flex flex-col gap-3">
        <input type="hidden" name="worldId" value={worldId} />
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnPath" value={returnPath} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-link-create-expires-at">Ablaufdatum (optional)</Label>
          <Input id="share-link-create-expires-at" type="datetime-local" name="expiresAt" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="share-link-create-password">Passwort (optional)</Label>
          <Input
            id="share-link-create-password"
            type="password"
            name="password"
            autoComplete="new-password"
          />
        </div>

        <label className={CHECKBOX_ROW_CLASS}>
          <input type="checkbox" name="readOnly" defaultChecked className={CHECKBOX_CLASS} />
          Nur-Lesen-Link
        </label>

        <label className={CHECKBOX_ROW_CLASS}>
          <input type="checkbox" name="logAccess" className={CHECKBOX_CLASS} />
          Zugriff protokollieren
        </label>

        <Button type="submit">Link erstellen</Button>
      </form>

      {previewHref && (
        <p>
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost" })}
          >
            Vorschau anzeigen
          </a>
        </p>
      )}

      {links.length > 0 && (
        <ul className="flex flex-col gap-4">
          {links.map((link) => (
            <li
              key={link.id}
              className={cn(
                "flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-sm text-card-foreground shadow-sm",
                !link.enabled && "opacity-60",
              )}
            >
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <code className="text-xs break-all">{getShareLinkPublicUrl(link.token)}</code>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={link.enabled ? "success" : "default"}>
                    {link.enabled ? "Aktiv" : "Deaktiviert"}
                  </Badge>
                  <span>Erstellt {formatStudioDateOrDash(link.createdAt)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>Ablauf: {formatStudioDateOrDash(link.expiresAt)}</span>
                  <Badge variant={link.hasPassword ? "info" : "default"}>
                    {link.hasPassword ? "Passwort" : "Kein Passwort"}
                  </Badge>
                  <Badge variant="default">{link.readOnly ? "Nur-Lesen" : "Bearbeitbar"}</Badge>
                  <Badge variant={link.logAccess ? "info" : "default"}>
                    {link.logAccess ? "Protokoll an" : "Protokoll aus"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => copyLink(link.token)}>
                  {copiedToken === link.token ? "Kopiert!" : "Link kopieren"}
                </Button>

                {link.enabled && (
                  <form action={disableShareLinkAction}>
                    <input type="hidden" name="linkId" value={link.id} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <Button type="submit" variant="ghost" size="sm">
                      Deaktivieren
                    </Button>
                  </form>
                )}

                <form action={updateShareLinkAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="linkId" value={link.id} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`share-link-${link.id}-expires-at`}>Ablaufdatum</Label>
                    <Input
                      id={`share-link-${link.id}-expires-at`}
                      type="datetime-local"
                      name="expiresAt"
                      defaultValue={toDateTimeLocal(link.expiresAt)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`share-link-${link.id}-password`}>Neues Passwort</Label>
                    <Input
                      id={`share-link-${link.id}-password`}
                      type="password"
                      name="password"
                      autoComplete="new-password"
                    />
                  </div>
                  {link.hasPassword && (
                    <label className={CHECKBOX_ROW_CLASS}>
                      <input type="checkbox" name="clearPassword" className={CHECKBOX_CLASS} />
                      Passwort entfernen
                    </label>
                  )}
                  <label className={CHECKBOX_ROW_CLASS}>
                    <input
                      type="checkbox"
                      name="readOnly"
                      defaultChecked={link.readOnly}
                      className={CHECKBOX_CLASS}
                    />
                    Nur-Lesen
                  </label>
                  <label className={CHECKBOX_ROW_CLASS}>
                    <input
                      type="checkbox"
                      name="logAccess"
                      defaultChecked={link.logAccess}
                      className={CHECKBOX_CLASS}
                    />
                    Zugriff protokollieren
                  </label>
                  <Button type="submit" variant="ghost" size="sm">
                    Einstellungen speichern
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
