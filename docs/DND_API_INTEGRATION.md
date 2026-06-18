# DnD API Integration

Externe D&D-5e-Datenquellen für UWE — **ohne D&D Beyond Scraping**.

## Unterstützte APIs

| Provider | Package | Beschreibung |
|----------|---------|--------------|
| Open5e | `@uwe/dnd-api` | `https://api.open5e.com` — Monster, Spells |
| D&D 5e SRD | `@uwe/dnd-api` | `https://www.dnd5eapi.co` — SRD-Ressourcen |
| D&D Beyond | DB only | **Manuelle Link-Referenz** — kein Scraping |

## ENV

| Variable | Default |
|----------|---------|
| `DND_OPEN5E_ENABLED` | `true` |
| `DND_SRD_API_ENABLED` | `true` |
| `DND_API_CACHE_TTL_SECONDS` | `86400` |

## Nutzung

1. Welt öffnen → **DnD API** in Sidebar
2. Suche nach Monster/Spells (Open5e + SRD)
3. D&D Beyond: manuell URL + Titel speichern
4. Optional mit UWE-Seite verknüpfen (`pageId`)

## API Routes

- `GET /api/dnd-api?q=goblin&worldSlug=terra` — Suche + Beyond-Referenzen
- `GET /api/dnd-api?provider=open5e&slug=goblin` — Detail (cached)
- `POST /api/dnd-api` — `action: add_beyond_reference`

## Cache

`DndApiCacheEntry` in SQLite — reduziert externe API-Calls.

## Sicherheit

- Keine D&D Beyond Credentials
- URL-Validierung: muss `dndbeyond.com` enthalten
- Admin-only Studio API
- Nur Suchbegriffe verlassen den Host — vollständige JSON-Payloads werden lokal gecacht

## Lizenz & Attribution

| Quelle | Lizenz | Hinweis |
|--------|--------|---------|
| [Open5e](https://open5e.com) | CC-BY | Bei Nutzung in Handouts/Portal Attribution zu Open5e und Originalautor erforderlich |
| [dnd5eapi.co](https://www.dnd5eapi.co) | SRD (OGL) | Nur System Reference Document — kein Volltext von Wizards-Produkten |
| D&D Beyond | — | Nur manuelle Links, kein Content-Import |

UWE speichert keine Lizenz-Metadaten pro Cache-Eintrag. DM ist für korrekte Attribution bei veröffentlichten Inhalten verantwortlich.

## Phase 2

- Statblock-Import als UWE-Seite
- Encounter-Builder mit Open5e-Monstern
- Offline-SRD-Bundle
