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
- **Eigenschaften-Panel**: Position, Größe, Schrift, Ausrichtung, DM-only
- **Undo/Redo** (Strg+Z / Strg+Y), Duplizieren, Löschen
- **Snap-to-Grid** (0,1 Zoll), Safe Area
- Tastatur: Pfeiltasten zum Verschieben, Entf zum Löschen

## Templates

- System-Templates (Standard 6×4, Nur Text, Nur Bild, Handout Kompakt)
- Eigenes Layout: Label speichern → **Als Template speichern**
- Templates duplizieren, umbenennen, löschen (nur Welt-Templates)

## Drucklisten

- Mehrere Labels sammeln, Reihenfolge und **Kopien** pro Label
- Status: offen, exportiert, gedruckt, archiviert
- Markierung **Für nächste Session**
- Export als mehrseitiges **HTML** oder **PDF**

## DM vs. Player Version

- Player-Export entfernt DM-only Blöcke und markierte Elemente
- Warnungen bei gemischtem Content, DM-only Bildern, Secrets
- Export mit `?version=player` oder ohne `includeDmOnly=1`
- DM-Export: `?includeDmOnly=1` oder `?version=dm`

## PDF / HTML / Druck

| Format | Beschreibung |
|--------|--------------|
| HTML | Einzeldatei mit Layout-CSS |
| PDF | `pdf-lib` — Text und Bilder, mehrseitig für Drucklisten |
| Print | Browser-Druck mit `@page { size: 6in 4in }` |

Bei PDF-Fehlern: Fallback auf **Print-HTML** (Header `X-UWE-Export-Fallback: 1`).

Optionen in Layout-Einstellungen: Safe Area, Schnittmarken (vorbereitet), druckerfreundlicher Modus.

## Text-Kürzung (Auto-Fit)

- Ampel: **Passt** / **Knapp** / **Zu lang**
- Modi: konservativ, normal, aggressiv
- **Originaltext** bleibt erhalten (`originalText`)
- Buttons: Automatisch passend machen, Original wiederherstellen
- KI-Kürzung: UI vorbereitet, aktiv wenn AI Brain konfiguriert ist

## Bilder

- Aus **Media Library** wählen (im Editor: Bildelement → Dropdown)
- Upload über bestehende Asset-Pipeline
- Alt-Text, DM-only Warnung bei nicht player-visible Assets
- **Bildgenerierung**: Provider-Interface vorbereitet, standardmäßig deaktiviert

## Integration

- **Seiten-Detail**: „Label erstellen“
- **Labels/new**: Quelle per URL `?sourceRef=page:ID` vorauswählen
- Weitere Integrationen (Dungeon Cockpit, Session, Search): schrittweise erweiterbar

## Technische Grenzen

- Kein vollwertiger Canva-Ersatz — fokussierter 6×4-Editor
- QR-Codes nutzen externen Generator (qrserver.com) im HTML-Export
- PNG-Export: noch nicht implementiert
- KI-Bildgenerierung: Interface only (`LABEL_IMAGE_PROVIDER=disabled`)
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
# Optional — Bildgenerierung (noch nicht aktiv)
LABEL_IMAGE_PROVIDER=disabled
```
