# Rohclips der bewegten Bühne

**Hier kommen die heruntergeladenen Artlist-Clips hinein — unverändert, so wie
sie aus dem Konto kommen.**

Die MP4s in diesem Ordner sind von Git ausgenommen (`.gitignore`). Das ist
Absicht: zwanzig Rohclips sind mehrere hundert Megabyte, und sie sind ein
Zwischenschritt. Ins Repository gehört nur das Ergebnis der Nachbearbeitung in
`assets/scenes-motion/` — dort liegen die Dateien nach dem Verlangsamen und
Komprimieren bei wenigen hundert Kilobyte pro Clip.

## Dateinamen

Genau diese zwanzig, ohne Abweichung — das Nachbearbeitungsskript findet sie
über den Namen:

```
landing-hell-desktop.mp4    landing-hell-mobil.mp4
landing-dunkel-desktop.mp4  landing-dunkel-mobil.mp4
portal-hell-desktop.mp4     portal-hell-mobil.mp4
portal-dunkel-desktop.mp4   portal-dunkel-mobil.mp4
studio-hell-desktop.mp4     studio-hell-mobil.mp4
studio-dunkel-desktop.mp4   studio-dunkel-mobil.mp4
brain-hell-desktop.mp4      brain-hell-mobil.mp4
brain-dunkel-desktop.mp4    brain-dunkel-mobil.mp4
family-hell-desktop.mp4     family-hell-mobil.mp4
family-dunkel-desktop.mp4   family-dunkel-mobil.mp4
```

Das Schema ist `<bereich>-<modus>-<variante>.mp4` und stammt aus
`packages/shared-ui/src/scene/sceneMotion.ts`. `desktop` ist quer (16:9),
`mobil` ist hochkant (9:16).

Es müssen nicht alle zwanzig auf einmal da sein. Landing, Portal und Studio
tragen die korrigierte Rankensprache und können allein verarbeitet werden;
Brain und Family stehen noch auf der alten Fassung (siehe
[docs/design/scene-motion-assets.md](../../docs/design/scene-motion-assets.md),
Abschnitt „Offen: Rankenkorrektur für Family und Brain").

## Standbilder nicht nötig

Das Poster wird aus dem **ersten Frame des Clips** geschnitten — nur so ist der
Übergang vom Poster zum laufenden Video unsichtbar. Die separat erzeugten
Standbilder aus dem Artlist-Konto werden dafür nicht gebraucht.

## Danach

Die Nachbearbeitung (verlangsamen, MP4 + WebM, Poster als AVIF und WebP,
Größenprüfung) schreibt nach `assets/scenes-motion/`; von dort verteilt
`scripts/copy-scenes.mjs` in `apps/*/public/scenes/motion/`. Sichtbar wird ein
Clip erst, wenn sein `available`-Schalter in `sceneMotion.ts` auf `true` steht.
