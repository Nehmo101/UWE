# docs/design — Design-Historie

Dieser Ordner sammelt **historische** Design-Audits, Migrationsnotizen und
Analysen (Theme-System, Odysseus-UI-Vergleich, QA-Reports etc.), die während
der Design-V2-Umstellung entstanden sind.

**Kanonischer Style Guide:** [`design-system/`](../../design-system/) im
Repo-Root — Farb-/Typo-/Spacing-Tokens, das 9-Theme-System, wiederverwendbare
Komponenten und volle Studio/Portal-Nachbauten. Starte dort mit
[`design-system/README.md`](../../design-system/README.md), wenn du neue
UWE-Oberflächen oder Assets baust. Dieser Ordner hier ist Kontext/Archiv, keine
lebende Quelle.

## Ausnahmen — diese drei sind lebend, nicht Archiv

Sie beschreiben Verträge, die im Code durchgesetzt werden, und gehören beim
Bauen gelesen:

| Datei | Worum es geht |
|---|---|
| [`responsive-tables.md`](responsive-tables.md) | Wie Tabellen auf dem Telefon zu Karten werden — der Attribut-Vertrag mit `design-v3/data.css` und die Rollen-Falle |
| [`theme-a11y-checklist.md`](theme-a11y-checklist.md) | Die Schwellen der Prüfmatrix (12 px / 24 px / 44 px), zwei Kaskadenfallen, bewusst unveränderte Werte |
| [`scene-motion-assets.md`](scene-motion-assets.md) | Register der bewegten Szenen: Dateinamen, `available`-Schalter, Rankensprache |
