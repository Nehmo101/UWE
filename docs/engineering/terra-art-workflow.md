# Terra Art Factory

Dieser Workflow ist der gemeinsame Produktionsweg für Codex, Claude, Cursor
und andere Agents. `/uweterra` ist die Komfortoberfläche; die reproduzierbare
Wahrheit sind die CLI, JSON-Verträge und Git-Artefakte im Repository.

## Phasen

1. **Baseline:** `pnpm terra:art:doctor` und `pnpm terra:art:baseline` erzeugen
   identische Referenzansichten aus `terra/art-direction/scenes.json`.
2. **Kandidaten:** Ein Brief unter `terra/art-direction/briefs/` definiert
   Wirkung, zu bewahrende Teile, Szenen und Kandidatenzahl. `generate` bedient
   Blender ausschließlich headless über das versionierte Python-Skript.
3. **Runtime:** Optimierte GLB-v2-Dateien werden erst nach Freigabe im
   Asset-Manifest registriert. Die Runtime lädt nur die unterstützte statische
   Mesh-Teilmenge; jeder Fehler fällt auf das prozedurale Asset zurück.
4. **Abnahme:** `compare` erzeugt ein Kontaktblatt. Der Agent stoppt bei der
   Zwischenabnahme und erneut vor der Endfreigabe.
5. **CI/Portabilität:** Verträge, Manifest, Skills, Loader und Fallback werden
   in normalen Tests geprüft. MCPs sind optional; jeder Agent kann die CLI
   verwenden.

## Befehle

```bash
pnpm terra:art:doctor
pnpm terra:art:doctor --strict
pnpm terra:art:baseline
pnpm terra:art:generate --brief weltschildkroete
pnpm terra:art:optimize --input .artifacts/terra-art/candidates/weltschildkroete/a/model.glb --output .artifacts/terra-art/candidates/weltschildkroete/a/model-optimized.glb
pnpm terra:art:render --brief weltschildkroete
pnpm terra:art:compare --brief weltschildkroete
pnpm terra:art:verify
pnpm terra:art:approve --asset weltschildkroete --candidate a --by owner
```

`doctor --strict` verlangt Blender und glTF Transform. Ohne `--strict` bleiben
Baseline, Report und Vertragsprüfungen nutzbar. Arbeitsdateien liegen unter
`.artifacts/terra-art/` und werden nicht eingecheckt.

## Freigaberegeln

- Bei visueller Arbeit genau drei Kandidaten erzeugen, sofern der Brief nichts
  anderes verlangt.
- Baseline, Kamera, Auflösung und Tageszeit zwischen Kandidaten nicht ändern.
- Keine Variante vor ausdrücklicher Auswahl integrieren.
- `approve` nur nach eindeutiger Endfreigabe ausführen; der Befehl schreibt das
  Approval-Artefakt, kopiert das optimierte GLB und aktualisiert dessen Hash.
- Danach `pnpm terra:art:verify`, `pnpm test:terra` und den gültigen Repo-Gate
  ausführen.

## Prompt

```text
/uweterra

Modernisiere die Weltschildkröte nach dem Terra-Art-Vertrag. Erzeuge drei
Varianten, führe alle technischen Prüfungen selbstständig aus und stoppe bei
der Zwischenabnahme.
```

Nach Auswahl reicht: `Variante B, Halsansatz breiter, Mund neutraler.`
Zur Endfreigabe: `B2 ist freigegeben. Integrieren, testen, committen und PR erstellen.`

## Sicherheit und Grenzen

Blender und Browserwerkzeuge laufen nur im Entwicklungsprofil, ohne `.env`
oder Produktions-Secrets. Drittassets benötigen Herkunft und Lizenz. Der
erste Blender-Adapter unterstützt bewusst nur den Schildkrötenkopf; neue
Assetklassen bekommen einen eigenen deterministischen Adapter statt eines
beliebigen Text-zu-3D-Dienstes.
