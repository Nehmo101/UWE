# Mail Center — UWE Kommunikationsmodul

Das Mail Center ist **kein Gmail-Ersatz**, sondern ein reviewbarer Versand für UWE-Kontexte.

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

## Routen

- `/mail` — Status, Logs, Kommunikations-Flows
- `/mail/compose?kind=…` — Entwurf mit Vorschau
- `/api/mail/send` — Versand (Studio-auth)
- `/api/mail/compose` — Server-seitiger Entwurf

## Sicherheit

- DM-only Inhalte blockieren Versand ohne `confirmDmOnly`
- `assertMailApiResponseHasNoSecrets` in API-Responses
- Spieler-Recaps nutzen nur `summaryPlayer`, nie `summaryDm`
