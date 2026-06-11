# KnoteForge → UWE Import-Konzept

## Ziel

UWE erhält **Importmöglichkeiten** für Daten aus KnoteForge Local, ohne das alte Repository zu verändern oder fest zu koppeln. Der Import ist **einseitig** (KnoteForge → UWE) und erfolgt über exportierte Dateien, nicht über Live-Sync.

## Prinzipien

1. **Unabhängigkeit** — KnoteForge Local bleibt unangetastet. UWE kennt keinen KnoteForge-Quellcode.
2. **Dateibasierter Import** — Nutzer exportieren aus KnoteForge (oder erzeugen manuell kompatible Dateien) und laden sie in UWE Studio hoch.
3. **Preview vor Commit** — Jeder Import durchläuft zuerst eine Vorschau. Ohne explizite Bestätigung werden keine Daten geschrieben.
4. **Normiertes Zwischenformat** — Parser liefern ein `NormalizedImportBundle`, unabhängig vom Eingabeformat (JSON, später Markdown/HTML).
5. **Nachvollziehbarkeit** — Importierte Inhalte tragen Provenance in `ContentBlock.metadata` (`source: "knoteforge"`, `knoteforgeId`, `importedAt`).

## Architektur

```
Export-Datei (JSON / Markdown / HTML)
        │
        ▼
  ImportSource (Parser-Interface)
        │
        ▼
  NormalizedImportBundle
        │
        ├──► mapEntity() ──► MappedPageDraft
        │
        ├──► detectDuplicates() ──► ImportItemPreview[]
        │
        ▼
  previewImport()  ──► Vorschau (read-only)
        │
        ▼ (nur bei confirmed: true)
  executeImport()  ──► UweRepository (Pages, Blocks, Links)
```

## Entity-Mapping (KnoteForge → UWE)

| KnoteForge-Konzept      | UWE-Ziel                                      |
|-------------------------|-----------------------------------------------|
| Wissenstext             | `Page` type `lore`                            |
| Dungeon                 | `Page` type `dungeon`                         |
| Ebene                   | `Page` type `dungeon_level`                   |
| Raum                    | `Page` type `room`                            |
| Encounter               | `Page` type `encounter`                       |
| Loot                    | `Page` type `item` oder `ContentBlock`        |
| Soundboard-Button       | `Page` type `sound` oder Asset-Referenz       |
| Session-Notiz           | `Page` type `session` oder `note`             |
| Spieler-Notiz           | `ContentBlock` type `player_text`             |
| Bild                    | Asset (Pfad in Block-`metadata`)              |
| Handout                 | `Page` type `handout`                         |
| Label                   | druckbares Asset/Template (Block-`metadata`)  |

Unbekannte Typen werden als `note` importiert und in der Vorschau gemeldet.

## Import-Status

| Status      | Bedeutung                                              |
|-------------|--------------------------------------------------------|
| `new`       | Neue Seite, kein Konflikt in der Zielwelt              |
| `update`    | Bestehende Seite mit gleicher KnoteForge-ID erkannt    |
| `duplicate` | Gleicher Titel/Slug/Alias, aber keine sichere Zuordnung|
| `conflict`  | Slug/Titel/Asset-Kollision, manuelle Entscheidung nötig|
| `skipped`   | Ungültige oder leere Daten, wird nicht importiert     |

## Duplikaterkennung

- Gleicher **Titel** (case-insensitive, Locale `de`)
- Gleicher **Slug** in der Zielwelt
- Überlappende **Aliase**
- Gleiche **Asset-Dateien** (Hash oder Dateiname)

## Slug-Konflikte

Bei Slug-Kollisionen innerhalb eines Imports oder mit bestehenden Seiten:

1. Wenn `update` (gleiche `knoteforgeId`): bestehenden Slug beibehalten.
2. Sonst: Suffix anhängen (`-2`, `-3`, …) bis eindeutig.
3. Konflikte mit unterschiedlichem Inhalt → Status `conflict` in der Vorschau.

## Formate

### Phase 1: JSON (implementiert)

Schema `KnoteForgeExport` v1.0 — siehe `src/types.ts`. Beispiel:

```json
{
  "version": "1.0",
  "source": "knoteforge",
  "world": { "name": "Terra", "slug": "terra" },
  "entities": [
    {
      "id": "kf-dungeon-1",
      "type": "dungeon",
      "title": "Die Verlorene Mine",
      "content": "Eine alte Zwergenmine …"
    }
  ]
}
```

### Phase 2: Markdown / HTML (vorbereitet)

Parser-Stubs implementieren `ImportSource` und werfen `UnsupportedImportFormatError`, bis die Formate spezifiziert sind.

## API (Studio)

| Endpoint                    | Methode | Beschreibung                    |
|-----------------------------|---------|---------------------------------|
| `/api/import/preview`       | POST    | Vorschau, keine DB-Änderungen   |
| `/api/import/execute`       | POST    | Import nach Bestätigung         |

Beide Endpunkte erwarten `{ format, content, worldSlug, confirmed? }`.

## Sicherheit

- Nur Studio (DM-Bereich), nicht Portal
- Standard-Sichtbarkeit importierter Inhalte: `dm_only` + `draft`
- Fehlerhafte Einzeldatensätze crashen nicht den Gesamtimport
