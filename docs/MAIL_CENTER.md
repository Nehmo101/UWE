# Mail Center — UWE Kommunikationsmodul

Seit H10 ist die Arbeit geteilt: das **Postfach** (IMAP-Empfang, Reader, Triage,
Regeln, Mail-Chat) liegt in **Brain** unter `/mail`, hinter dem Häkchen `Brain`.
In **Studio** bleibt der reviewbare **Vorlagen-Versand** für DM-Kontexte — dieses
Dokument beschreibt den Studio-Teil.

## Flows (immer mit Vorschau + manueller Freigabe)

| Flow | Template-Kind | Auslöser |
|------|---------------|----------|
| Session-Recap | `session_recap` | Session-Detail / Compose |
| Session-Erinnerung | `session_reminder` | `/today`, Session mit Datum |
| Handout-Link | `handout` | Asset-Freigabe |
| Player-Preview | `share_link` | Share-Link |
| Vertragserinnerung | `contract_reminder` | Verträge mit Fälligkeit |
| Backup-Warnung | `backup_warning` | `/today`, Mail Center |
| Systemwarnung | `system_warning` | Mail Center |
| Terrain-Verleih | `terrain_rental` | Werkstatt-Projekt |

**Keine automatischen Mails** ohne explizite Freigabe — der Versand erfolgt nur über `MailSendForm` („Mail jetzt senden“).

## Bausteine

- **Templates** — `MailTemplate` (system + pro Welt), Platzhalter `{{variable}}`
- **Recipient Groups** — `MailRecipientGroup`, System-Gruppe `players`
- **Send Logs** — `MailMessageLog` mit Status, Empfängern, optional Body-Preview
- **SMTP** — nur serverseitig aus `.env`, nie im Repo

## Routen (Studio)

- `/mail/compose?kind=…` — Entwurf mit Vorschau (Vorlagen füllt die Seite
  serverseitig über `createMailComposeService`)
- `/api/mail/send` — Versand (Studio-auth)
- `/api/mail/recipients` — Empfänger-Gruppen, Spieler-Sync (`sync_players`)

Die früheren Lese-Routen (`/api/mail/inbox`, `/status`, `/logs`, `/templates`,
`/accounts`, `/compose`, `/test`) sind mit H10 entfallen — Postfach-Lesen läuft
über Brains `/api/mail/**`, und die Compose-Seite braucht keinen API-Umweg.

## Sicherheit

- DM-only Inhalte blockieren Versand ohne `confirmDmOnly`
- `assertMailApiResponseHasNoSecrets` in API-Responses
- Spieler-Recaps nutzen nur `summaryPlayer`, nie `summaryDm`
