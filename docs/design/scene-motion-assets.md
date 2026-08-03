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
| Szenen | 10 (5 Bereiche × Tag/Nacht) — alle erzeugt, alle **scharf geschaltet** |
| Dateien | 80 (je Szene: Desktop + Mobil × MP4 + WebM + AVIF + WebP) |
| Ausgeliefert je Seitenaufruf | **eine** Datei — Bereich, Tageszeit und Viewport bestimmen welche (160–690 KB WebM) |
| Quelle | Artlist AI Suite — eigene Generierung, kein Fremdmaterial |
| Bildmodell | Seedream 5.0 T2I (2K), 200 Credits je 2 Bilder |
| Videomodell | Kling 1.6 Standard I2V, 600 Credits je 10-Sekunden-Clip |
| Ton | keiner — die Clips werden ohne Audiospur erzeugt und eingebunden |
| Ablage (Rohclips) | `assets/scenes-motion-raw/` — versioniert, die reproduzierbare Quelle |
| Ablage (fertig) | `assets/scenes-motion/` |
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

1. `node scripts/build-scene-motion.mjs` erzeugt die vier Dateien aus dem
   Rohclip in `assets/scenes-motion-raw/`.
2. `available: true` im passenden Eintrag setzen, dann
   `node --import tsx scripts/copy-scenes.mjs`.

**Stand: alle zwanzig stehen auf `true`.**

Fehlt danach eine Datei, bricht `copy-scenes.mjs` mit einer Fehlermeldung ab —
absichtlich, denn ein toter `<source>` wäre ein Netzwerkfehler im Browser des
Nutzers.

### `available: true` heißt nicht „eingebunden"

Der Satz oben hat einmal genau diesen Irrtum ausgelöst, deshalb steht er hier
ausdrücklich: `available` sagt nur, dass die **Dateien** da sind und
ausgeliefert werden. Ob sie jemand *anfragt*, entscheidet etwas ganz anderes —
ob eine Route `PaintedScene` rendert.

Eine Zeit lang standen alle zwanzig Schalter auf `true`, alle achtzig Dateien
lagen in fünf `public/scenes/motion/`-Ordnern — und drei Bereiche haben nie
eine einzige davon abgerufen: Studio band überhaupt keine Route ein, Family
reichte den Szenen-Index an keiner Stelle in seine Shell, Brain und Portal
hatten je genau einen Auftritt. Aufgefallen ist es nicht, weil
`e2e/portal-motion.spec.ts` nur das Portal kannte.

Dagegen steht jetzt `scripts/scene-motion-coverage.test.ts`: Ein Bereich mit
`available: true` ohne Auftritt ist ein roter Build, und ein eingetragener
Auftritt, der den Index nicht mehr übergibt, ebenfalls.

## Wo die Bühne steht

Die zweite Hälfte der Wahrheit — die erste ist die Datei-Tabelle oben.

| Bereich | Auftritt | Form |
|---|---|---|
| Landing | `apps/landing/app/page.tsx`, `apps/studio/app/page.tsx` | Vollbild |
| Studio | Shell-Band auf den Einstiegen (`src/lib/studio-scene.ts`) | Band |
| Portal | Welten-Hub und Weltseite | `SceneHero` |
| Brain | Start und `/today` | `SceneHero` |
| Family | Start | `SceneHero` |

**Die Regel dahinter:** die Bühne trägt die Stellen, an denen man *ankommt* —
Startseiten, Hubs, Einstiege. Unterseiten bleiben ruhig. Ein 16-Sekunden-Loop
hinter einer Einkaufsliste oder einem Wiki-Editor ist Unruhe, kein Design.
Wer eine Bühne hinzufügt, trägt sie in `scene-motion-coverage.test.ts` nach.

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

### Wie die Ranken in den Ursprungsbildern tatsächlich aussehen

Nachgesehen in `assets/scenes/`, vor allem in `nacht-desktop/06-wueste-riesenwurzeln`,
`tag-desktop/04-gruenes-tal-wurzelbruecken`, `nacht-desktop/04-moor-lichtranken`
und `tag-desktop/09-nebelsee-wurzelbaum`. Sechs Eigenschaften, alle
bildbestimmend:

1. **Sie verlassen das Bild nach oben.** In *jedem* der vier Bilder laufen die
   Wurzeln über den oberen Bildrand hinaus. Es gibt nirgends eine sichtbare
   Spitze und nirgends ein Auslaufen ins Nichts. Genau daher kommt die
   Unendlichkeit — nicht aus Dunst, sondern aus dem **Bildrand**. Eine Wurzel,
   deren Ende man sieht, hat ein Maß; eine, die aus dem Bild läuft, nicht.
2. **Sie sind Bündel aus vielen Strängen, keine glatten Säulen.** Jede Wurzel
   besteht aus Dutzenden paralleler Fasern, die sich langsam umeinander drehen,
   mit tief liegenden Schattenrillen dazwischen. In `09-nebelsee-wurzelbaum`
   kann man einzelne Stränge über- und untereinander verfolgen. Das ist der
   Grund, warum sie *gewachsen* wirken und nicht gegossen.
3. **Unten spreizen sie sich zu einem Wurzelfuß.** Wo sie Boden oder Wasser
   treffen, fächern sie in viele einzelne Wurzeln auf, greifen über Fels,
   spannen sich über Wasser. Der Fuß ist breit und vielbeinig, der Stamm
   sammelt sich erst nach oben.
4. **Sie drehen sich.** Das Bündel rotiert über seine Länge in einer langsamen
   Spirale.
5. **Farbe ist nicht flaches Weiß.** Warmes Elfenbein auf den belichteten
   Graten, kühles Blaugrau in den Rillen. Nachts kommt das Licht aus den Rillen
   heraus — die Wurzel leuchtet von innen zwischen den Strängen.
6. **Sie tragen Leben und geben dadurch Maßstab.** Blattplattformen,
   Wasserfälle, winzige Bauten hängen an ihnen. Ohne etwas Kleines daran liest
   sich die Größe nicht.

**Was in der ersten Charge falsch war:** glatte, geschlossene Oberflächen (sie
lasen sich als gegossenes Harz, Stoff oder Dampf), spitz zulaufende Enden
mitten im Bild, freistehende Säulen ohne Wurzelfuß, keine Drehung, kein
kleines Detail für den Maßstab. Family und Portal zeigen sichtbare Spitzen —
das ist der Fehler, der zuerst weg muss.

**Die Ranken wachsen nach oben, nicht über den Himmel.** Sie steigen senkrecht
aus der Landschaft auf, verjüngen sich beim Klettern und verlieren sich weit
oben in den hohen Wolken — das Auge findet kein Ende. Das ist die Eigenschaft,
die sie ehrwürdig macht: nicht ihre Breite, sondern dass man ihnen nicht bis
zur Spitze folgen kann. Bögen, die sich über den Himmel spannen und wieder
herunterkommen, haben ein Ende und wirken dadurch klein.

Der Satz dafür im Prompt — die Fassung nach der Analyse oben:

> Colossal pale roots rise out of the landscape and climb upward. Each root is
> a thick bundle of many parallel fibrous strands twisted slowly around each
> other, with deep shadowed grooves between them; warm ivory on the lit ridges,
> cool blue-grey in the grooves. At the bottom each one splays into dozens of
> separate roots that grip the rock and arch over the ground. They DO NOT taper
> to a point and DO NOT end anywhere inside the picture — each one is cut off
> by the TOP EDGE of the frame and continues beyond it.

Drei Dinge daran sind aus Fehlversuchen gelernt und keine Geschmacksfrage:

- **„NOT braided rope, NOT cables, NOT tentacles"** — ohne diese Ausschlüsse
  rendern die Modelle die Ranken als geflochtene Seile im Vordergrund. Das
  verdeckt genau die Fläche, auf der später Text steht.
- **„the lower two thirds is deliberately open"** — ohne diese Vorgabe
  komponieren die Modelle mittig und füllen die Bildmitte mit Detail. Der
  Hintergrund kämpft dann mit dem Inhalt, statt ihn zu tragen.
- **„their tops disappearing into the high clouds"** — ohne den Zusatz
  schließen die Modelle die Ranke zu einem Bogen oder kappen sie am oberen
  Bildrand. Beides nimmt ihr die Größe.

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

### 3 · Nachbearbeitung — `scripts/build-scene-motion.mjs`

Die Handarbeit von früher ist ein Skript. Drei Dinge daran weichen von dem ab,
was hier ursprünglich stand, und alle drei kommen daher, dass die tatsächlich
gelieferten Rohclips anders aussahen als geplant.

**Die Clips sind 5,1 s lang, nicht 10 s.** Und wichtiger: sie **laufen nicht
rund**. Die Kamera fährt langsam ins Bild; Anfangs- und Endbild unterscheiden
sich deutlich (SSIM 0,30 bei der Landing-Tagszene). Ein `loop`-Video springt an
dieser Naht sichtbar zurück — bei einem Hintergrund, den man minutenlang
ansieht, der auffälligste denkbare Fehler.

Die Antwort ist ein **Pendelschnitt**: vorwärts, dann rückwärts. Die Naht
verschwindet konstruktionsbedingt (SSIM danach **0,95**), und die Länge
verdoppelt sich auf die gewünschten 16,2 s. Die an Wende und Rücksprung
doppelten Einzelbilder werden abgeschnitten, sonst stockt die Bewegung dort je
um ein Bild.

**Keine Zwischenbildberechnung.** `minterpolate` stand hier einmal als Rezept;
es ist bei diesen Motiven falsch. Die Bilder bestehen aus fein gezeichneten,
sich kreuzenden Wurzelsträngen, und bewegungskompensierte Interpolation
verwischt genau solche Linien. Bei 1,6-facher Verlangsamung bleiben 20 echte
Bilder je Sekunde — für driftende Wolken und eine kaum merkliche Kamerafahrt
flüssig, und jedes Bild ist gemalt statt gerechnet.

**1280 × 720 statt 1920 × 1080.** Die Rohclips kommen in 720p (hochkant
720 × 1280). Hochskaliert entstünde keine Zeichnung, nur weichere Kanten und
doppelte Bytes. Hinter dem Verdunkelungs-Veil ist die Quellauflösung reichlich.

**VP9 mit CRF 44, nicht 36.** Bei 36 war das WebM kaum kleiner als das MP4 und
lohnte den zweiten Codec nicht. Bei 44 liegt es rund zwei Drittel darunter
(570 statt 1619 KB bei der Landing-Tagszene), und die feinen Stränge bleiben
erhalten — SSIM 0,96 gegen die H.264-Fassung.

```bash
node scripts/build-scene-motion.mjs                 # alles Vorhandene
node scripts/build-scene-motion.mjs --only=landing  # ein Bereich
node scripts/build-scene-motion.mjs --force         # auch Aktuelles neu
```

Das Skript ist idempotent und meldet je Datei die Größe gegen das Budget.

### 4 · Zielgrößen

| Fassung | Auflösung | Budget | Tatsächlich |
|---|---|---|---|
| Desktop MP4 | 1280 × 720 | ≤ 1,8 MB | 506–1629 KB |
| Desktop WebM | 1280 × 720 | ≤ 1,1 MB | 160–689 KB |
| Mobil MP4 | 720 × 1280 | ≤ 1,2 MB | 544–1122 KB |
| Mobil WebM | 720 × 1280 | ≤ 0,8 MB | 161–533 KB |
| Poster AVIF | wie Video | ≤ 90 KB | 39–78 KB |
| Poster WebP | wie Video | ≤ 140 KB | 43–124 KB |

Alle 80 Dateien liegen unter Budget; zusammen 26,7 MB. Ausgeliefert wird davon
nie mehr als **eine** Datei je Seitenaufruf — `SceneStage` lädt den Clip des
aktuellen Bereichs, der aktuellen Tageszeit und des aktuellen Viewports, und
auch den erst, wenn die Bühne im Viewport steht.

Geprüft wird das in `e2e/portal-motion.spec.ts`: dass wirklich Bilddaten
ankommen (`readyState`), und dass unter `prefers-reduced-motion` **gar kein**
`<video>` entsteht.

## Erzeugte Assets

### Landing — neu generiert (Fassung 2)

Die maßgebliche Fassung. Sie ist die erste, die dem Rankenmotiv der
Ursprungsbilder folgt: vier Wurzeln als verdrehte Strangbündel, unten breite
vielbeinige Wurzelfüße über Fels und Fluss, oben **vom Bildrand abgeschnitten**.
Blattplattformen mit winzigen Bauten und ein Wasserfall an einer Wurzel geben
den Maßstab — ohne dieses kleine Detail liest sich die Größe nicht.

| Zieldatei | Standbild | Clip |
|---|---|---|
| `landing-hell-desktop` | `019fb397-2000-7f86-a935-23439e79af00` | `019fb398-78fc-7791-8afe-d4c3dc50e74f` |
| `landing-dunkel-desktop` | `019fb398-66c7-7448-aa1d-211033b918ee` | `019fb399-6b56-7b27-a944-80a123f0d22f` |
| `landing-hell-mobil` | `019fb398-a0be-7bd9-8397-c21fc681c6b7` | `019fb399-d01e-70f9-bb95-fb9a78d225cd` |
| `landing-dunkel-mobil` | `019fb399-be2e-7f2c-8d00-28810878c9a4` | `019fb39a-ba29-7670-9a99-469b4d3b949f` |

Nachts leuchtet das Licht **aus den Rillen zwischen den Strängen**, nicht durch
die Oberfläche — so wie in `nacht-desktop/04-moor-lichtranken`.

### Landing — Fassung 1, abgelöst

Nicht verwenden. Die Wurzeln spannen sich hier als Bögen über den Himmel und
kommen wieder herunter; sie haben damit ein sichtbares Ende und wirken klein.
Die Einträge bleiben nur stehen, damit die Generierungen im Konto zuordenbar
sind.

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

### Family — fertig generiert

Bewohnter Garten zwischen aufsteigenden Wurzelsäulen; Nachmittagslicht bzw.
Abend mit Fensterlichtern und Glühwürmchen. Untere Bildhälfte offene Wiese.

| Zieldatei | Standbild | Clip |
|---|---|---|
| `family-hell-desktop` | `019fb37f-8255-732a-b945-c0978afef39f` | `019fb380-a352-7046-aa73-0ac384f6e32b` |
| `family-dunkel-desktop` | `019fb381-ffaa-7058-80ad-b29fc6f6da3c` | `019fb383-92c0-72ab-8f7b-38cce6285e55` |
| `family-hell-mobil` | `019fb383-1380-7033-9a8c-81e941182fda` | `019fb384-1987-7ac0-82bb-63f265d8605e` |
| `family-dunkel-mobil` | `019fb383-8189-7282-aa94-9f15c27c62ab` | `019fb384-604e-78d6-a35b-bde6ba143ea1` |

### Portal — neu generiert (Fassung 2)

Küstenflachwasser mit drei Wurzelbündeln, die in ihren eigenen Spiegelungen
stehen; Wurzelfüße greifen über halb versunkenen Fels. Blattplattform mit
winzigen Bauten und ein Wasserfall, der ins Meer fällt. Fernes Tor am Horizont.
Nachts Mondsichel, Mondbahn und warme Fensterlichter.

| Zieldatei | Standbild | Clip |
|---|---|---|
| `portal-hell-desktop` | `019fb39d-722f-7d71-a569-61c9667962aa` | `019fb39e-ba37-7f37-acd6-cd02aa4b8fc0` |
| `portal-dunkel-desktop` | `019fb39e-a7c1-75b7-8ce2-9a1f9f2524cb` | `019fb39f-ac64-7b13-bd4a-4c7689234fd3` |
| `portal-hell-mobil` | `019fb39e-e1f3-7428-970c-250b2a09c3bd` | `019fb39f-e270-7549-a10b-95134476049a` |
| `portal-dunkel-mobil` | `019fb39f-c024-7fdb-9d01-b837bd93563d` | `019fb3a0-c957-7493-83a7-06a72b8ca39a` |

### Studio — neu generiert (Fassung 2)

Werkstattterrasse in der Astgabel eines Wurzelbündels; die Wurzel spreizt sich
und trägt die Diele. Hängende Ranken und Blätter als Maßstab, dazu Tisch,
Papierrollen und Laterne. Zweite Wurzel im Dunst. Die ruhigste Komposition:
untere Bildhälfte und linke Seite sind blanke Diele. Nachts brennt die Laterne.

| Zieldatei | Standbild | Clip |
|---|---|---|
| `studio-hell-desktop` | `019fb3a0-0a62-7e4e-b0a0-e28a81c2b249` | `019fb3a1-6e2d-7367-8b83-cc973cc7e24c` |
| `studio-dunkel-desktop` | `019fb3a1-5c51-7b1d-862c-bf1f461e701a` | `019fb3a2-60a3-74f2-bb1c-b51d40ce41cf` |
| `studio-hell-mobil` | `019fb3a1-a1ac-7410-81bf-7e2ab4246ac3` | `019fb3a2-b2df-772e-b60e-4114643e1e54` |
| `studio-dunkel-mobil` | `019fb3a2-955e-78a1-858b-56e8f9202247` | `019fb3a3-8ea4-7a0e-90dd-cc80b2ab1a7d` |

### Brain — fertig generiert

Stiller Hain aus Wurzelsäulen in spiegelglattem Wasser, dazwischen schwebende
Lichtpunkte an dünnen Fäden — ein Wissensnetz als Andeutung, keine
Gehirngrafik und keine Neon-Neuronen. Dämmerung bzw. tiefe Nacht.

| Zieldatei | Standbild | Clip |
|---|---|---|
| `brain-hell-desktop` | `019fb38d-923d-7fe7-a2df-868962be32bc` | `019fb38f-0996-77a5-8342-5b9b3490d873` |
| `brain-dunkel-desktop` | `019fb38e-f49e-7879-9fcf-7cf42f1df231` | `019fb38f-dd1f-71d7-bb31-c6d22f4d95d6` |
| `brain-hell-mobil` | `019fb38f-2cfd-797c-afa4-e104f1e83138` | `019fb390-2b62-7361-a6a7-14f4922657ab` |
| `brain-dunkel-mobil` | `019fb38f-eb5f-76b2-912e-3f999af91ca2` | `019fb390-f04c-77d1-b7f1-8627e272095b` |

### Offen: Rankenkorrektur für Family und Brain

Landing, Portal und Studio tragen die korrigierten Wurzeln. Family und Brain
stammen noch aus der Charge **vor** der Rankenanalyse: glatte, geschlossene
Säulen ohne Strangbündel und ohne Wurzelfuß, bei Family zusätzlich spitz
zulaufend und damit sichtbar im Bild endend.

Aufwand: 8 Standbilder à 100 und 8 Clips à 300 Credits, zusammen 3 200. Das
laufende Kontingent ist damit erschöpft; die Credits erneuern sich am
30. August.

### Clip-Länge und Nachbearbeitung

Die vier Landing-Clips sind 10 Sekunden lang, die sechzehn übrigen 5 Sekunden.
Der Unterschied ist eine Budget-Entscheidung: Kling rechnet 60 Credits je
Sekunde, und 5-Sekunden-Clips haben die Neufassung der Landing-Szene mit
senkrechten Ranken erst finanzierbar gemacht.

Beide Längen werden in der Nachbearbeitung auf dieselbe Zielzeit gedehnt. Weil
der Ausgangsclip nur 5 Sekunden hat, reicht `setpts` allein nicht — ohne
Zwischenbilder ruckelt ein Wolkenzug sichtbar. `minterpolate` rechnet sie
bewegungskompensiert dazu:

```bash
# 5 s -> 13 s, mit synthetisierten Zwischenbildern
ffmpeg -y -i "$IN" -an \
  -vf "setpts=2.6*PTS,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 27 \
  -movflags +faststart "$OUT.mp4"
```

Für die 10-Sekunden-Clips der Landing genügt der einfachere Weg aus Schritt 3
(`setpts=2.4*PTS,fps=24`), weil dort genug echte Bilder vorliegen.

## Lizenz

Alle Szenen sind mit dem Artlist-Konto des Projekteigners erzeugt und enthalten
kein lizenziertes Fremdmaterial und keine Werke Dritter. Sie stehen unter
derselben Lizenz wie das übrige Repository — siehe [LICENSE](../../LICENSE),
analog zum Standbild-Bestand in `assets/scenes/`
(siehe [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md), Abschnitt 4).

## Egress: erledigt, anders als gedacht

Die Artlist-Auslieferungshosts sind aus der Agenten-Umgebung heraus weiterhin
nicht erreichbar (403 auf CONNECT):

```
mcp.artlist.io
cms-toolkit-artifacts.artlist.io
cms-toolkit-public-artifacts.artlist.io
ai-toolkit-generations.imgix.net
```

Der Weg drumherum war einfacher als gedacht: `list_generations` liefert zu
jeder Generierung eine **signierte Datei-URL** mit langer Gültigkeit gleich mit.
Damit ließ sich die Zuordnung Zieldatei → Download als Liste erzeugen; das
Herunterladen selbst geschah außerhalb der Umgebung, die Rohclips liegen seither
in `assets/scenes-motion-raw/` und alles Weitere lief wieder hier.

Die signierten URLs gehören **nicht** ins Repository — sie tragen
Zugriffssignaturen.
