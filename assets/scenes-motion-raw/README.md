# Rohclips der bewegten Bühne

**Hier liegen die heruntergeladenen Artlist-Clips — unverändert, so wie sie aus
dem Konto kommen.**

Sie sind versioniert (rund 104 MB), und das ist eine bewusste Entscheidung: sie
sind die einzige Quelle, aus der sich `assets/scenes-motion/` reproduzieren
lässt. Ohne sie hinge jede Neuberechnung an signierten Links in einem fremden
Konto. Wer die Kompression nachjustiert, braucht genau diese Dateien —
`node scripts/build-scene-motion.mjs --force` erzeugt daraus alles neu.

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

```bash
node scripts/build-scene-motion.mjs      # → assets/scenes-motion/
node --import tsx scripts/copy-scenes.mjs # → apps/*/public/scenes/motion/
```

Was dabei passiert und warum, steht im Kopf von
[`scripts/build-scene-motion.mjs`](../../scripts/build-scene-motion.mjs) — vor
allem der Pendelschnitt, der die sichtbare Naht der Rohclips repariert.
Sichtbar wird ein Clip erst, wenn sein `available`-Schalter in
`sceneMotion.ts` auf `true` steht; für alle zwanzig ist er das.
