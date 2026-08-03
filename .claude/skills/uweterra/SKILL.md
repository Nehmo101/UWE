---
name: uweterra
description: Prompt-gesteuerte UWE-Terra-Art-Pipeline für Three.js, Hero-Assets, Blender/glTF, Shader, Biome, visuelle Regression und Performance. Nutze diesen Skill bei Aufgaben unter terra/, bei /uweterra, bei Asset-Modernisierung oder -Erstellung und bei visuellen Zwischen- oder Endabnahmen.
---

# UWE Terra

Lies `docs/engineering/terra-art-workflow.md` und den passenden Brief unter
`terra/art-direction/briefs/`. Nutze ausschließlich die versionierten
`pnpm terra:art:*`-Befehle; direkte Blender-GUI-Arbeit ist kein reproduzierbarer
Produktionsweg.

## Ablauf

1. `pnpm terra:art:doctor` ausführen.
2. Vor Änderungen `pnpm terra:art:baseline` ausführen.
3. Prompt in einem Brief festhalten oder bestehenden Brief aktualisieren.
4. Genau die im Brief verlangten Kandidaten mit `terra:art:generate` erzeugen.
5. Jeden Kandidaten optimieren und mit `terra:art:verify` prüfen.
6. Mit `terra:art:render` identische Ansichten rendern und `terra:art:compare` ausführen.
7. Bei visueller Arbeit immer bei der Zwischenabnahme stoppen.
8. Nur die ausdrücklich gewählte Variante weiterbearbeiten.
9. Vor Commit/PR erneut bei der Endabnahme stoppen.
10. Erst nach ausdrücklicher Freigabe `terra:art:approve`, vollständige Gates,
    Commit und Pull Request ausführen.

## Grenzen

- Genehmigte Baselines und Approval-Dateien nie ohne ausdrückliche Freigabe ersetzen.
- Blender/MCP nur im Entwicklungsprofil und ohne Produktions-Secrets verwenden.
- Fehlen optionale Werkzeuge, nicht improvisieren: Doctor-Ergebnis melden.
- Externe Assets brauchen Manifest, SHA-256, Budgetprüfung und prozeduralen Fallback.
- Alte Karten, Determinismus, Reduced Motion und Terra-Materialwirkung bewahren.

## Nutzerinteraktion

Bei Zwischenabnahme Kontaktblatt, Kandidatenbezeichnungen, technische Differenzen
und eine klare Empfehlung liefern. Der Nutzer braucht keine Blender-Kenntnisse.
