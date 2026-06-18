# Lizenzlage: Odysseus → UWE Feature-Portierung

## Odysseus

| Feld | Wert |
|------|------|
| Repository | https://github.com/pewdiepie-archdaemon/odysseus |
| Lizenz | **GNU Affero General Public License v3.0 (AGPL-3.0)** |
| Sprache | Python (FastAPI) |
| Rolle für UWE | Feature-Referenz und Inspirationsquelle — **kein Submodule, kein Vendor-Bundle** |

## UWE

| Feld | Wert |
|------|------|
| Repository | UWE (dieses Repo) |
| Lizenz | Proprietär / projektspezifisch (kein AGPL) |
| Sprache | TypeScript (Next.js), Prisma, SQLite |

## Regel für alle Portierungs-PRs

**Kein blindes Kopieren von Odysseus-Quellcode.**

AGPL-3.0 verpflichtet bei Netzwerk-Software zur Quellcode-Weitergabe modifizierter Versionen. Eine direkte Code-Übernahme würde UWE unter AGPL stellen oder Lizenzverletzungen riskieren.

### Erlaubt

- Funktionsweise, UX-Flows und Datenmodell-Ideen analysieren
- Architektur-Patterns verstehen und in UWE-eigenem TypeScript/Next.js/Prisma-Stil **neu implementieren**
- Öffentliche API-Spezifikationen (z. B. OpenAI-compatible, CalDAV, IMAP) als Integrationsziele nutzen
- In PR-Beschreibungen und Docs klar als **„inspiriert, nativ neu implementiert“** kennzeichnen

### Nicht erlaubt (ohne explizite AGPL-Akzeptanz)

- Python-Module, JS-Dateien oder SQL-Schemas aus Odysseus kopieren/einfügen
- AGPL-lizenzierte Snippets in UWE-Dateien übernehmen
- Odysseus als eingebetteten Workspace oder Fork in UWE betreiben

### Ausnahme: explizite Code-Übernahme

Falls in Einzelfällen Code übernommen werden soll:

1. Vollständige AGPL-3.0-Compliance für UWE als Produkt prüfen und dokumentieren
2. Quellenangabe und Lizenzheader in jeder betroffenen Datei
3. Orchestrator-Freigabe und PR-Lizenznotiz: **„Code kopiert unter AGPL-3.0“**

**Stand Orchestrator-Entscheidung:** Alle geplanten Feature-Ports werden **nativ neu implementiert**. Keine Code-Kopie.

## PR-Lizenznotiz (Pflichtfeld)

Jeder Subagent-PR enthält einen Abschnitt:

```md
## Lizenznotiz
- [ ] Code kopiert (AGPL — nicht geplant)
- [x] Inspiriert von Odysseus UX/Architektur, nativ in UWE implementiert
- [ ] Gemischt (Details: …)
```

## Referenz-Analyse ohne Code-Import

Die Feature-Analyse in diesem Ordner basiert auf:

- Öffentliches Odysseus-Repository (shallow clone, read-only Analyse)
- GitHub API (Lizenz-Metadaten)
- Keine persistente Odysseus-Kopie im UWE-Repo
