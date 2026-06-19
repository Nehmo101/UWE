# Label-Druck und Handout-Editor (UWE Studio)

UWE Studio bietet einen DM-only Label-/Handout-Editor für **6×4 Zoll** Karten und Spieler-Handouts.

## Schnellstart

1. Öffne **Welt → Labels** (`/worlds/[worldSlug]/labels`)
2. **Neues Label** erstellen — aus Seite, Dungeon-Raum, Block, Asset oder manuell
3. Im **visuellen Editor** Elemente positionieren, speichern
4. **Vorschau** oder **Drucken** / **PDF exportieren**

## Label-Bibliothek

Die Bibliothek hat drei Bereiche:

| Tab | Inhalt |
|-----|--------|
| **Labels** | Gespeicherte Labels mit Druckstatus |
| **Templates** | System- und Welt-Vorlagen |
| **Drucklisten** | Mehrere Labels mit Kopien für den Druck |

## Visueller Editor

- Arbeitsfläche im echten **6×4-Zoll**-Verhältnis
- **Drag & Drop**, Skalieren, Auswahl per Klick
- Elemente: Titel, Text, Bild, Box, Trennlinie, QR-Code
- **Bild**: Media Library, Upload im Editor, einfacher Zuschnitt (Fokus/Zoom), Thumbnail
- **Eigenschaften-Panel**: Position, Größe, Schrift, Ausrichtung, DM-only
- **Undo/Redo** (Strg+Z / Strg+Y), Duplizieren, Löschen
- **Snap-to-Grid** (0,1 Zoll), Safe Area
- Tastatur: Pfeiltasten zum Verschieben, Entf zum Löschen

## Werkstatt- und Filament-Labels

Für Miniaturen, Terrain und 3D-Druck:

```typescript
import {
  buildWorkshopLabelContent,
  buildFilamentLabelContent,
  resolveWorkshopLabelTemplateSlug,
} from "@uwe/database/server";
```

- **Werkstatt-Projekt** → Label mit Material/Filament-Liste und optionalem QR zur UWE-Seite
- **Filament-Spule** → kompaktes 4×2 Text-Label (Material, Farbe, Gewicht)

Builder: `packages/database/src/label-workshop-service.ts`

## Templates

- System-Templates (Standard 6×4, Nur Text, Nur Bild, Handout Kompakt, **Miniatur-Kiste**, **Terrain-Kiste**, **Filament-Spule**, **3D-Druck Projekt**)
- Eigenes Layout: Label speichern → **Als Template speichern**
- Templates duplizieren, umbenennen, löschen (nur Welt-Templates)

## Drucklisten

- Mehrere Labels sammeln, **Reihenfolge per Drag & Drop**, **Kopien** direkt editierbar
- Status: offen, exportiert, gedruckt, archiviert
- Markierung **Für nächste Session**
- Automatisch vorbereiten aus **Session**, **Dungeon-Raum** oder **Seite**
- Export als mehrseitiges **HTML**, **PDF** oder **PNG** (einzelnes Label; Druckliste: erstes Label)

## DM vs. Player Version

- Player-Export entfernt DM-only Blöcke und markierte Elemente
- Warnungen bei gemischtem Content, DM-only Bildern, Secrets, ausgeblendeten Elementen
- Export mit `?version=player` oder ohne `includeDmOnly=1`
- DM-Export: `?includeDmOnly=1` oder `?version=dm`
- Geheimnisse im Dungeon Cockpit: **DM-Label** (mit DM-only) oder **Spieler-Label**

## PDF / HTML / Druck / PNG

| Format | Beschreibung |
|--------|--------------|
| HTML | Einzeldatei mit Layout-CSS |
| PDF | `pdf-lib` — Text und Bilder, mehrseitig für Drucklisten |
| PNG | SVG-Rendering, optional `sharp` — Fallback auf SVG |
| Print | Browser-Druck mit `@page { size: 6in 4in }` |

Bei PDF-Fehlern: Fallback auf **Print-HTML** (Header `X-UWE-Export-Fallback: 1`, Grund in `X-UWE-Export-Fallback-Reason`). Die Studio-UI zeigt den Hinweis in der Export-Sidebar.

Layout-Optionen: Safe Area, **Schnittmarken**, druckerfreundlicher Modus.

## Text-Kürzung (Auto-Fit & KI)

- Ampel: **Passt** / **Knapp** / **Zu lang**
- Modi: konservativ, normal, aggressiv
- **Originaltext** bleibt erhalten (`originalText`)
- Buttons: Automatisch passend machen, Original wiederherstellen, **Vorher/Nachher-Vergleich**
- **KI-Kürzung**: aktiv wenn AI Brain konfiguriert ist; Fallback auf regelbasierten Auto-Fit
- KI schreibt keine DM-only Inhalte in Player-Labels; Ausgabe vor Speichern im Editor editierbar

## Bilder

- Aus **Media Library** wählen oder im Editor hochladen
- Upload über `/api/worlds/[slug]/assets/upload`
- Zuschnitt: Fokus X/Y und Zoom im Eigenschaften-Panel
- Alt-Text, DM-only Warnung bei nicht player-visible Assets
- **Bildgenerierung**: `LabelImageProvider` — standardmäßig deaktiviert (`LABEL_IMAGE_PROVIDER=disabled`)

## Integration (Kontext-Menüs)

| Bereich | Aktion |
|---------|--------|
| **Seiten-Detail** | Label erstellen (`?sourceRef=page:ID`) |
| **Seite bearbeiten** | Aus Block Label erstellen |
| **Dungeon Cockpit** | Label pro Raum, Encounter, Loot, Rätsel, Fallen, Handouts, Geheimnisse, Assets |
| **Session** | Labels für nächste Session / Druckliste aus verknüpften Seiten |
| **Media Library** | Bild als Label |
| **Suche** | Optional Label erstellen pro Treffer |
| **Command Palette** | Labels öffnen, Neues Label |
| **Secrets** | DM-Label vs. Spieler-Label |

## Activity Log

- Label erstellt / geändert / exportiert
- Druckliste erstellt / geändert / gedruckt / exportiert

## Technische Grenzen

- Kein vollwertiger Canva-Ersatz — fokussierter 6×4-Editor
- QR-Codes nutzen externen Generator (qrserver.com) im HTML-Export
- PNG-Drucklisten: derzeit erstes Label (Mehrfach-PNG/ZIP optional später)
- KI-Bildgenerierung: Interface only bis Provider aktiv
- Sehr komplexe Layouts: PDF kann auf Print-HTML zurückfallen

## Lokales Testen

```bash
pnpm install
pnpm --filter @uwe/database db:migrate
pnpm --filter @uwe/database test -- src/label-editor.test.ts src/label-service.test.ts
pnpm dev:studio
# http://localhost:3000/worlds/[slug]/labels
```

## Umgebungsvariablen

```env
# AI Brain — KI-Textkürzung im Label-Editor
AI_BRAIN_ENABLED=true
AI_USE_MOCK=true   # lokale Tests ohne API-Key

# Optional — Bildgenerierung (noch nicht aktiv)
LABEL_IMAGE_PROVIDER=disabled
```
