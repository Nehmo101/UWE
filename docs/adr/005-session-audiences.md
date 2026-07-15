# ADR 005: Getrennte Session-Audiences je App

## Status

Accepted — 2026-07-15

Diese ADR beschreibt das Zielkonzept. Cookie, Session-Schema, Login und
Middleware bleiben in dieser Welle unverändert.

## Kontext

Studio und Portal verwenden heute laut [SECURITY.md](../../SECURITY.md) dasselbe
Cookie `uwe_session` und dieselbe Platform-Session. Rollen verhindern bereits
wesentliche Zugriffe, der Session-Nachweis ist aber nicht an eine App-Audience
gebunden. Mit einem owner-only Brain würde eine über Apps wiederverwendbare
Session den Blast Radius von Routing-, Cookie- oder Guard-Fehlern vergrößern.

## Entscheidung

Im Zielbild wird jede Browser-Session für genau eine Audience ausgestellt:
`portal`, `studio` oder `brain`. Eine für eine Audience ausgestellte Session
wird von den anderen Apps abgelehnt. Die gemeinsame Platform-Identität darf
erhalten bleiben; App-Audience, Rolle und fachliche Berechtigung werden
serverseitig gemeinsam geprüft.

Die Ziel-Rollenmatrix ist:

| Rolle | Portal-Audience | Studio-Audience | Brain-Audience |
|---|---:|---:|---:|
| `owner` | Ja, nur Portal-Projektion | Ja | Ja |
| `admin` | Ja, nur Portal-Projektion | Ja | Nein |
| `dm` | Ja, nur Portal-Projektion | Ja | Nein |
| `player` | Ja, nach Weltberechtigung | Nein | Nein |
| `readonly` / `guest` | Ja, innerhalb der freigegebenen Sicht | Nein | Nein |

Eine Audience ist notwendig, aber nicht hinreichend:

- Portal prüft weiterhin Weltmitgliedschaft, Ziel-Scope, Publish-Status und
  Visibility. Auch `owner` sieht dort niemals `dm_only`.
- Studio prüft Rollen und Admin-Sonderrechte zusätzlich zur Studio-Audience.
- Brain prüft zusätzlich zwingend die Rolle `owner` und das lokale/LAN
  Exposure-Modell.
- Session-Audiences ersetzen weder CSRF-Schutz noch Route- und API-Guards.

Die spätere Contract-Welle entscheidet die technische Repräsentation, das
Anmelde-/Übergabeverhalten und die Cookie-Namen. Diese ADR schreibt bewusst
keine sofortige Cookie- oder Datenbankänderung vor.

## Konsequenzen

- Ein kompromittierter oder fehlgerouteter Portal-Sessionnachweis ist nicht
  automatisch in Studio oder Brain gültig.
- Cross-App-Navigation kann später eine erneute, explizite Session-Ausstellung
  erfordern; UX und Single-Sign-On-Verhalten bleiben zu entwerfen.
- Auth-Tests müssen künftig Audience-Replay, Rollenmatrix, Logout,
  Session-Widerruf und Brain-owner-only abdecken.
- Bis zur Implementierung bleibt die aktuelle `uwe_session`-Semantik die
  Runtime-Wahrheit; Dokumentation darf das Zielbild nicht als bereits aktiv
  darstellen.

## Alternativen

- **Eine Session für alle Apps:** verworfen als Zielzustand, weil ein Fehler an
  einer weniger privilegierten Surface auf höher privilegierte Apps übergreift.
- **Nur unterschiedliche Cookie-Namen:** verworfen als unzureichend, wenn der
  serverseitige Sessiondatensatz keine Audience erzwingt.
- **Vollständig getrennte Identitätssysteme:** verworfen, weil eine gemeinsame
  Platform-Identität mit strikt gebundenen App-Sessions ausreicht.
