# Konfiguration

Alle Einstellungen laufen über Umgebungsvariablen. `.env.example` ist die
kommentierte Referenz, `.env.production.example` die Produktionsvariante.

Geheimnisse gehören nie in den Quelltext — `pnpm secret:scan` prüft das bei
jedem Lauf des Quality Gates.

## Die wichtigsten Werte

| Variable | Bedeutung |
|---|---|
| `SESSION_SECRET` | Pflicht in Produktion, zufällig erzeugen |
| `DATABASE_URL` | Standard `file:./data/uwe.db` |
| `BRAIN_DATABASE_URL` | Getrennte Datenbank für den Owner-Bereich |
| `FAMILY_DATABASE_URL` | Getrennte Datenbank für den Family-Bereich |
| `PUBLIC_APP_URL` | Öffentliche Basis-URL, u. a. für Tunnel-Checks |
| `SESSION_COOKIE_DOMAIN` | Für geteilte Anmeldung über Subdomains |
| `BRAIN_EXPOSURE` | `loopback` (Standard), `lan`, `public` oder `off` |
| `MAX_UPLOAD_MB` | Obergrenze für Uploads |

`BRAIN_EXPOSURE` steuert, von wo der Owner-Bereich überhaupt erreichbar ist.
Der Standard `loopback` bedeutet: nur vom Host selbst. Wer den Wert anhebt,
öffnet den privaten Bereich bewusst — die Prüfung dazu liegt in
`apps/brain/src/lib/exposure.ts`.

`SESSION_COOKIE_DOMAIN` wird gebraucht, sobald die Apps unter verschiedenen
Subdomains derselben Domain laufen und eine gemeinsame Anmeldung teilen sollen.
Ohne den Wert gilt ein Cookie nur für genau einen Host.

## Weiterführend

- [secrets.md](secrets.md) — welche Geheimnisse es gibt und wo sie herkommen
- [deployment.md](deployment.md) — Konfiguration im Deployment-Kontext
- [engineering/self-service-config.md](engineering/self-service-config.md) —
  laufende Einstellungen gehören nicht in `.env`, sondern werden in UWE selbst
  konfiguriert und zum Host zurückgeschrieben
