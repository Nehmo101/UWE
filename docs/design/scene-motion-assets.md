# Bewegte Bühne — Asset-Register

Die zehn Hintergrundszenen der „Gemalten Welt", ihre Dateien, ihre Herkunft und
die Verarbeitungsschritte. Dies ist die einzige Stelle, an der Bereich,
Tageszeit, Quelle, Lizenz, Format und Dateigröße zusammen stehen.

Der Code liest davon nichts — die Wahrheit für die Anwendung ist
`packages/shared-ui/src/scene/sceneMotion.ts`. Dieses Dokument erklärt, wie die
Dateien entstehen und wie man sie ersetzt.

## Kurzfassung

| | |
|---|---|
| Szenen | 10 (5 Bereiche × Tag/Nacht) |
| Dateien | 40 (je Szene: Desktop + Mobil × MP4 + WebM + AVIF + WebP) |
| Quelle | Artlist AI Suite — eigene Generierung, kein Fremdmaterial |
| Bildmodell | Seedream 5.0 T2I (2K), 200 Credits je 2 Bilder |
| Videomodell | Kling 1.6 Standard I2V, 600 Credits je 10-Sekunden-Clip |
| Ton | keiner — die Clips werden ohne Audiospur erzeugt und eingebunden |
| Ablage (Quelle) | `assets/scenes-motion/` |
| Ablage (ausgeliefert) | `apps/<app>/public/scenes/motion/` (gitignored, erzeugt) |

## Dateinamen

Der Name ist berechenbar, nicht eingetragen:

```
<bereich>-<modus>-<variante>.<endung>

bereich  = landing | family | portal | studio | brain
modus    = hell | dunkel
variante = desktop | mobil
endung   = mp4 | webm | avif | webp
```

Beispiel für eine vollständige Szene:

```
assets/scenes-motion/portal-dunkel-desktop.mp4
assets/scenes-motion/portal-dunkel-desktop.webm
assets/scenes-motion/portal-dunkel-desktop.avif
assets/scenes-motion/portal-dunkel-desktop.webp
```

`scripts/copy-scenes.mjs` kopiert je App nur die Dateien der Bereiche, die
diese App zeigt — dieselbe Mechanik wie bei den Standbildern, und aus demselben
Grund: die CSP erlaubt `media-src 'self'`, jede App muss also vom eigenen
Origin ausliefern.

## Der Schalter, der zählt

In `sceneMotion.ts` steht pro Szene ein `available`-Flag. Solange es `false`
ist, rendert `SceneStage` **kein** `<video>`: kein Netzwerkaufruf, kein
Konsolenfehler, kein leeres Rechteck. Die Seite sieht dann genau so aus wie mit
der gemalten Standbild-Bühne allein.

Eine Szene wird also in zwei Schritten scharf geschaltet:

1. Die vier Dateien nach `assets/scenes-motion/` legen.
2. `available: true` im passenden Eintrag setzen.

Fehlt danach eine Datei, bricht `copy-scenes.mjs` mit einer Fehlermeldung ab —
absichtlich, denn ein toter `<source>` wäre ein Netzwerkfehler im Browser des
Nutzers.

## Bildsprache

Alle zehn Szenen folgen derselben Anweisung. Der Prompt-Kern steht hier, damit
eine spätere Nachbestellung dieselbe Welt trifft:

> An anime film background painting — hand-painted gouache and poster colour on
> textured watercolour paper, with soft visible brush strokes and gentle paper
> grain. This is an ILLUSTRATION, a painted matte background in the tradition of
> classic hand-drawn animation. Not a photograph, not photorealistic, not 3D
> render, no CGI gloss.
>
> […Szene…] Rising organically out of the distant landscape are colossal pale
> root-forms — smooth ivory-white, almost like matte frosted glass, with a faint
> warm inner luminescence. They taper and curve naturally like something grown,
> with soft irregular swellings and slow organic bends; ancient, serene,
> monumental. They are NOT braided rope, NOT cables, NOT tentacles, NOT
> geometric hoops, NOT tree bark.
>
> Composition is critical: the roots sit in the UPPER THIRD and far distance
> only. The lower two thirds of the image is deliberately open, quiet and low in
> detail. Wide empty sky. Nothing tall in the foreground.
>
> Low contrast, muted and harmonious, gentle natural gradients, luminous
> atmospheric haze separating each depth layer.
>
> No people, no creatures, no buildings in the foreground, no text, no logos, no
> watermark, no lens flare, no sparkles, no heavy shadows.

Zwei Dinge daran sind aus Fehlversuchen gelernt und keine Geschmacksfrage:

- **„NOT braided rope, NOT cables, NOT tentacles"** — ohne diese Ausschlüsse
  rendern die Modelle die Ranken als geflochtene Seile im Vordergrund. Das
  verdeckt genau die Fläche, auf der später Text steht.
- **„the lower two thirds is deliberately open"** — ohne diese Vorgabe
  komponieren die Modelle mittig und füllen die Bildmitte mit Detail. Der
  Hintergrund kämpft dann mit dem Inhalt, statt ihn zu tragen.

### Die zehn Szenen

Tag- und Nachtfassung eines Bereichs zeigen **dieselbe Umgebung aus derselben
Kameraposition**. Der Hell/Dunkel-Wechsel soll sich wie ein Tageszeitenwechsel
anfühlen, nicht wie ein Ortswechsel.

| Bereich | Tag | Nacht |
|---|---|---|
| Landing | Weites Hochtal am Vormittag, zwei Wurzelbögen über dem Himmel | Dasselbe Tal nach Sonnenuntergang, Wurzeln glimmen von innen |
| Family | Bewohnter Garten zwischen Wurzelstämmen, warmes Nachmittagslicht | Derselbe Garten am Abend, Fensterlichter, Glühwürmchen |
| Portal | Küstenebene, Wurzelbrücke zu einem fernen Tor | Dieselbe Küste bei Nacht, warme Lichter am Tor, Mondbahn |
| Studio | Werkstattterrasse an einem Wurzelstamm, viel freie Fläche | Dieselbe Werkstatt bei Nacht, Laternenlicht |
| Brain | Stiller Hain aus hellen Wurzeln über Wasser, Dunst | Derselbe Hain bei Nacht, Lichtpunkte, Spiegelung |

## Herstellungsweg

### 1 · Standbild (wird zugleich das Poster)

Seedream 5.0 T2I, `aspect_ratio` `16:9` für Desktop bzw. `9:16` für Mobil,
`resolution: 2k`, `num_images: 2` zum Auswählen.

Die Mobilfassung wird **eigens generiert**, nicht aus dem Desktopbild
geschnitten: ein Ausschnitt aus 16:9 verliert entweder den Himmel oder die
freie Fläche unten, und genau die beiden werden gebraucht.

### 2 · Clip aus dem Standbild

Kling 1.6 Standard I2V mit dem Standbild als **Start- und Endframe**. Das ist
der Kniff für die Nahtlosigkeit: der Clip endet dort, wo er beginnt, also gibt
es beim Loop keinen Sprung — weder im Bild noch in der Bewegung.

Einstellungen: `duration: 10`, `resolution: 1080p`, `aspect_ratio` passend zum
Standbild.

Bewegungsanweisung im Prompt, für alle Szenen gleich gehalten:

> Motion is extremely slow and calm: high cloud banks drift slowly, thin mist
> layers glide through the middle distance, vegetation sways faintly, light
> shifts very gradually. Locked-off static camera: no camera movement, no zoom,
> no pan, no cuts, no transitions.

### 3 · Nachbearbeitung (ffmpeg)

Der Rohclip ist 10 Sekunden lang. Auf die geforderten 12–30 Sekunden kommt er
nicht durch Verlängern, sondern durch **Verlangsamen** — was die Bewegung
zugleich ruhiger macht, also genau in die gewünschte Richtung:

```bash
IN=roh/landing-hell-desktop.mp4
OUT=assets/scenes-motion/landing-hell-desktop

# 10 s -> 24 s, Bewegung entsprechend ruhiger; 24 fps reichen für Nebel und Wolken
ffmpeg -y -i "$IN" -an -vf "setpts=2.4*PTS,fps=24" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 27 \
  -movflags +faststart "$OUT.mp4"

# WebM/VP9 — deutlich kleiner bei gleicher Ruhe im Bild
ffmpeg -y -i "$IN" -an -vf "setpts=2.4*PTS,fps=24" \
  -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 "$OUT.webm"

# Poster: erster Frame, damit der Übergang Poster -> Video unsichtbar ist
ffmpeg -y -i "$IN" -frames:v 1 -f image2 "$OUT.png"
```

Poster nach AVIF und WebP (sharp ist im Repo vorhanden, keine neue
Abhängigkeit):

```bash
node -e "
const sharp = require('sharp');
const b = process.argv[1];
sharp(b + '.png').avif({ quality: 55 }).toFile(b + '.avif');
sharp(b + '.png').webp({ quality: 72 }).toFile(b + '.webp');
" "$OUT"
```

`-an` ist nicht optional: die Clips werden ohne Ton erzeugt **und** ohne
Tonspur ausgeliefert. Eine stumme Spur wäre unnötige Bytes und auf manchen
Browsern ein Grund, Autoplay zu verweigern.

### 4 · Zielgrößen

| Fassung | Auflösung | Ziel |
|---|---|---|
| Desktop MP4 | 1920 × 1080 | ≤ 1,8 MB |
| Desktop WebM | 1920 × 1080 | ≤ 1,1 MB |
| Mobil MP4 | 1080 × 1920 | ≤ 1,2 MB |
| Mobil WebM | 1080 × 1920 | ≤ 0,8 MB |
| Poster AVIF | wie Video | ≤ 90 KB |
| Poster WebP | wie Video | ≤ 140 KB |

Die Werte sind erreichbar, weil die Szenen kaum Bewegung enthalten — ein
Codec komprimiert ruhige Bilder sehr gut. Wird eine Datei deutlich größer, ist
meist zu viel Bewegung im Clip, und das ist ohnehin ein inhaltlicher Fehler.

Ausgeliefert wird trotzdem nie alles: `SceneStage` lädt **einen** Clip —
den des aktuellen Bereichs, der aktuellen Tageszeit und des aktuellen
Viewports — und auch den erst, wenn die Bühne im Viewport steht.

## Erzeugte Assets

### Landing — fertig generiert

Alle vier Fassungen liegen im Artlist-Konto. Die Nachtfassung ist per
Bild-zu-Bild aus der Tagfassung entstanden, die Hochformate per Bild-zu-Bild
aus der jeweiligen Querformat-Fassung — deshalb ist es nachweislich **dieselbe
Landschaft aus derselben Kameraposition**, nur zu anderer Tageszeit und in
anderem Format.

| Zieldatei | Standbild (Generierung) | Clip (Generierung) | Format | Dauer |
|---|---|---|---|---|
| `landing-hell-desktop` | `019fb334-a110-7e1e-8e34-6ad4cd13de2a` (Ausgabe 0) | `019fb346-fd1b-78bb-8e7f-e7b75f21c229` | 16:9, 1080p | 10 s |
| `landing-dunkel-desktop` | `019fb33e-db06-7716-97df-774bc787863b` | `019fb34b-a925-7d31-bd87-fee81fef8dca` | 16:9, 1080p | 10 s |
| `landing-hell-mobil` | `019fb342-9681-72c9-b003-bec70dbebb5a` | `019fb34e-b848-717a-ae74-cf4a866d452c` | 9:16, 1080p | 10 s |
| `landing-dunkel-mobil` | `019fb345-534d-7d88-b1b1-1e977631e9c3` | `019fb34f-891f-7cbe-81cf-f85558f8e448` | 9:16, 1080p | 10 s |

Szene: weites Hochtal, zwei kolossale Elfenbein-Wurzeln spannen sich in der
Ferne über den Himmel. Vormittagslicht bzw. klare Sternennacht mit von innen
glimmenden Wurzeln. Untere Bildhälfte in allen vier Fassungen offene Wiese —
die Fläche, auf der Titel und Produktkarten sitzen.

Verbraucht: 5 Bildgenerierungen (600 Credits) und 4 Videogenerierungen
(2 400 Credits), zuzüglich 1 200 Credits für zwei verworfene Text-zu-Video-
Versuche, aus denen die beiden Prompt-Regeln oben stammen.

### Übrige Bereiche

Family, Portal, Studio und Brain sind noch nicht generiert. Der Weg dafür
steht oben; die Prompts folgen demselben Aufbau, nur der Szenenteil wechselt.

## Lizenz

Alle Szenen sind mit dem Artlist-Konto des Projekteigners erzeugt und enthalten
kein lizenziertes Fremdmaterial und keine Werke Dritter. Sie stehen unter
derselben Lizenz wie das übrige Repository — siehe [LICENSE](../../LICENSE),
analog zum Standbild-Bestand in `assets/scenes/`
(siehe [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md), Abschnitt 4).

## Offene Einschränkung: Egress

Die Artlist-Auslieferungshosts sind aus der Agenten-Umgebung heraus nicht
erreichbar — die Egress-Policy dieser Sitzung beantwortet den Verbindungsaufbau
mit 403:

```
mcp.artlist.io
cms-toolkit-artifacts.artlist.io
cms-toolkit-public-artifacts.artlist.io
ai-toolkit-generations.imgix.net
```

Generieren funktioniert (das läuft über den MCP-Server), Herunterladen nicht.
Solange das so ist, müssen die Rohdateien manuell aus dem Artlist-Konto geholt
und nach `assets/scenes-motion/` gelegt werden; Schritt 3 und 4 laufen dann
lokal. Werden die vier Hosts in der Netzwerk-Policy der Umgebung freigegeben,
läuft die Kette vollständig automatisch.
