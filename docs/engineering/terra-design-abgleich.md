# Terra — Abgleich der Bedienoberfläche mit dem UWE-Design

**Stand:** 27.07.2026 · **Zweig:** `claude/terra-runde-h` · **Arbeitsbaum:** `C:\git\UWE-terra`
**Geänderte Datei:** `terra/src/ui/style.css` (vollständig neu gefasst).
`terra/index.html` blieb **unverändert** — die nötigen Anpassungen ließen sich alle im
Stylesheet erledigen.

Terra läuft demnächst als Frame unter den Atlas-Pfaden von UWE. Bis heute brachte es
seine eigene Gestaltung mit: hellblaue Akzente, weiße Karten mit kühlem Schlagschatten,
eine eigene Schriftwahl. Direkt neben der UWE-Oberfläche hätte das gewirkt wie ein
fremdes Programm in einem Fenster. Dieses Dokument hält fest, woran sich die Angleichung
orientiert hat, was sich Token für Token geändert hat, und wo bewusst abgewichen wurde.

---

## 1 · Was UWEs Design ausmacht

Der Befund ist erfreulicher als erwartet: **UWE hat bereits ein Thema, das genau Terras
Aufgabe löst** — eine Bedienoberfläche über einer gemalten Landschaft, hell und dunkel.
Es musste also nichts erfunden und nichts übersetzt werden.

### 1.1 Das Theme-Paar „Gemalte Welt"

`packages/shared-ui/src/theme/themes-ghibli.ts:95-113` definiert zwei Themes:

| ID | Label | Voreinstellung für |
|---|---|---|
| `uwe-ghibli-tag` | „Gemalte Welt — Tag" | Studio, Portal (`themes.ts:426-428`) |
| `uwe-ghibli-nacht` | „Gemalte Welt — Nacht" | Brain (`themes.ts:429`) |

Beide setzen `defaults: { font: "mono", background: "none", frostedGlass: true }`
(`themes-ghibli.ts:104, 112`). Das `background: "none"` ist dort ausdrücklich **Pflicht,
nicht Geschmack**: das Canvas des `BackgroundEffect` läge sonst auf derselben Ebene wie
die gemalte Szene (`themes-ghibli.ts:102-103`). Terra hat dieselbe Ausgangslage.

### 1.2 Farbtokens (`themes-ghibli.ts:29-93`)

Die Handoff-Namen (`--ground`, `--ink`, `--acc` …) stehen dort als Kommentar hinter jedem
Wert. Der referenzierte Ordner `design_handoff_ghibli_redesign/` **existiert im Repo
nicht** — diese Datei ist die einzige Quelle der Tabelle.

| Handoff | UWE-Token | Tag | Nacht |
|---|---|---|---|
| `--ground` | `--uwe-bg` | `#f1e8d4` (:30) | `#100e16` (:64) |
| — | `--uwe-bg-elevated` | `#fbf6ea` (:31) | `#12101a` (:65) |
| `--panel` | `--uwe-surface` | `rgba(251,246,234,.88)` (:32) | `rgba(18,16,26,.74)` (:66) |
| `--chrome` | `--uwe-panel` | `rgba(251,246,234,.92)` (:33) | `rgba(14,12,20,.92)` (:67) |
| `--panel-bd` | `--uwe-border` | `#e0d4ba` (:34) | `rgba(225,215,195,.17)` (:68) |
| `--ink` | `--uwe-fg` | `#211d17` (:36) | `#f1e8d4` (:70) |
| `--ink2` | `--uwe-fg-muted` | `#4a4336` (:37) | `#c9bfaf` (:71) |
| `--ink3` | `--uwe-fg-subtle` | `#8a7d64` (:38) | `#948b78` (:72) |
| `--acc` | `--uwe-accent` | `#c2622b` (:39) | `#e8a670` (:73) |
| `--acc-bg` | `--uwe-accent-muted` | `rgba(194,98,43,.13)` (:41) | `rgba(232,166,112,.16)` (:75) |
| `--teal` | `--uwe-link` | `#1a5c4f` (:42) | `#7fd0b4` (:76) |
| `--terra` | `--uwe-danger` | `#a8541b` (:43) | `#e8a670` (:77) |
| `--field` | `--uwe-input-bg` | `rgba(33,29,23,.08)` (:60) | `rgba(241,232,212,.07)` (:92) |

`--uwe-warning: #e0b15a` ist in beiden Modi gleich; der Handoff kennt die Rolle nicht,
der Wert ist der etablierte Parchment-Bernstein (`themes-ghibli.ts:18-19`).

**Der Akzent gehört nicht ins Theme, sondern zur App** (`design-v2/app-accent.css:24-61`):
Landing/Studio Terrakotta `#c2622b`/`#e8a670`, Portal Teal `#1a5c4f`/`#7fd0b4`, Brain
Violett `#55447c`/`#cabff0`. Terra hängt unter den Atlas-Pfaden von Studio und nimmt
deshalb Terrakotta.

### 1.3 Radien, Kanten, Glas (`design-v2/ghibli-shell.css:18-35`)

```css
--uwe-radius-pill: 999px;
--uwe-radius-card: 14px;   /* Handoff: Karten  */
--uwe-radius-btn: 9px;     /* Handoff: Buttons */
--uwe-radius-tile: 12px;   /* Handoff: Kacheln */
--uwe-border-width: 1.5px;
--uwe-border-width-chrome: 2px;
--uwe-glass-blur: 13px;
--uwe-touch-target: 44px;
```

Die Glaskarte selbst (`ghibli-shell.css:170-177`):

```css
.uwe-glass-surface {
  background: var(--uwe-card-bg);
  border: var(--uwe-border-width) solid var(--uwe-border);
  border-radius: var(--uwe-radius-card);
  box-shadow: var(--uwe-shadow-sm);
  backdrop-filter: blur(var(--uwe-glass-blur));
}
```

Schatten sind in UWE **theme-unabhängig** (`theme/tokens.ts:171-173`):
`sm 0 1px 2px rgba(0,0,0,.22)` · `md 0 4px 14px rgba(0,0,0,.28)` · `lg 0 16px 40px rgba(0,0,0,.38)`.
Abstandsraster 4/8 (`tokens.ts:162-167`), Radien sm/md/lg 6/8/12 px (`:168-170`).

### 1.4 Schrift — und warum sie ohne Webfont funktioniert

Die Ghibli-Themes laufen auf **Space Mono** als UI-Schrift, **Newsreader** (Serif) für
Überschriften (`ghibli-shell.css:77-88`). Geladen wird ausschließlich über
`next/font/google` in den vier Root-Layouts; im ganzen Repo gibt es **kein `@font-face`
und keinen Google-Fonts-`@import`**.

Entscheidend ist die Bauart der Fallback-Kette (`theme/tokens.ts:190-194`):

```
mono:  var(--uwe-font-space-mono, ui-monospace), 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace
sans:  system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif
serif: var(--uwe-font-newsreader, Georgia), 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif
```

Der Ausweichwert steht **innerhalb** des `var()`. Fehlt die Variable, greift
`ui-monospace` bzw. `Georgia` — das Design ist also ohne Webfont vollständig
lauffähig. Genau das braucht Terra: kein Bauschritt, und die CSP von UWE
(`script-src 'self'`) verbietet fremde Hosts ohnehin.

### 1.5 Zustände

| Zustand | Regel | Fundstelle |
|---|---|---|
| Fokus (kanonisch) | `outline: 2px solid var(--uwe-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 4px var(--uwe-focus-shadow)` | `uwe.css:627-640` |
| Fokus (Formularfeld) | `border-color: var(--uwe-focus-ring); box-shadow: 0 0 0 3px var(--uwe-focus-shadow)` | `apps/studio/app/globals.css:276-277` |
| Ringfarben | `focusRing` = 55 % Akzent, `focusShadow` = **22 %** Akzent | `theme/resolveColorTokens.ts:96-101` |
| Hover (Rail-Knopf) | Rahmen 35 % Akzent, Fläche 12 % Akzent | `uwe-components.css:39-44` |
| Hover (Helligkeit) | `filter: brightness(1.12)` | `auth/uwe-landing.css:292, 414` |
| Aktiv (Druck) | `transform: translateY(1px)` — kein Skalieren | `uwe-landing.css:215, 295`; `painted-scene.css:289-291` |
| Gewählter Nav-Eintrag | `color: accent; background: accent-muted; border-color: accent; font-weight: 700` | `ghibli-shell.css:145-153` |
| Übergänge | `0.15s ease`, abschaltbar über `prefers-reduced-motion` **und** `html[data-uwe-motion="off"]` | `app-accent.css:170-178` |

Die `--uwe-focus-shadow`-Werte in `uwe.css:75` und `uwe-components.css:8` stehen auf
20 %; zur Laufzeit gewinnt aber der Engine-Wert von 22 % aus `resolveColorTokens.ts:99`.
Die 20 % sind toter Vorab-Fallback. Terra übernimmt die **22 %**.

Weitere Marken-Regeln aus `design-system/README.md`: Groß-/Kleinschreibung normal
deutsch, Abschnittslabels **Großbuchstaben mit weiter Laufweite** (`:55`), **keine Emoji**
(`:61`), Primärknopf = **Tintenfüllung** mit Papierschrift (`:122`), Bewegung kurz und
funktional (`:131`).

### 1.6 Hat UWE einen dunklen Modus? — Ja, aber nicht als Schalter

Das ist die folgenreichste Frage des Auftrags, und die Antwort ist überraschend:

> „Hell/Dunkel is **not** a separate mode flag: the two halves are two theme ids, so the
> existing persistence, DB sync and anti-FOUC bootstrap carry the switch with no extra
> machinery." — `docs/design/uwe-theme-system.md:39`

Es gibt also **kein** `prefers-color-scheme` im Produktpfad. Die fünf Fundstellen im Repo
hängen alle am alten `data-uwe-appearance`-Zweig (`uwe.css:232`,
`uwe-visual-polish.css:45, 155`) oder liegen außerhalb der Next-Apps. Die Palette schreibt
die Theme-Engine als **Inline-Style auf `<html>`** (`theme/bootstrapScript.ts:157`,
`theme/applyTheme.ts:193`) und schlägt damit jede Stylesheet-Regel. Umgeschaltet wird
manuell über `ThemeModeToggle` (`scene/ThemeModeToggle.tsx:41-51`) mit `GHIBLI_COUNTERPART`.
Eine Automatik nach Tageszeit gibt es **nicht**.

Jedes der beiden Themes deklariert zusätzlich sein `color-scheme`
(`ghibli-shell.css:39` bzw. `:58`) — und genau daran hängt sich Terras Lösung auf
(Abschnitt 3.2).

---

## 2 · Terras bisherige Gestaltung

`terra/src/ui/style.css` war 99 Zeilen und hatte eine in sich stimmige, aber
eigenständige Sprache: kühles Blaugrau auf hellblauem Grund, ein einziger Akzent
`#2d74ab`, weiße Karten mit blauem Schlagschatten, `"Segoe UI"` als Grundschrift.
Bewusst gesetzt und erhaltenswert waren:

- die **Anordnung** — Werkzeugleiste links (66 px), Parameterpanel rechts (250 px),
  Leiste unten, Statusanzeige oben rechts, Hinweiszeile unten links;
- die **Glaskarte** als gemeinsame Grundform (`.card` mit `backdrop-filter`) — genau die
  Bauform, die UWEs `.uwe-glass-surface` auch hat;
- der **9-px-Radius** an Knöpfen und Feldern — trifft UWEs Handoff-Rhythmus bereits exakt;
- der Verzicht auf Übergangsanimation an `.fortschrittBalken` (der Balken wird bis zu
  60-mal je Sekunde gesetzt, eine Animation liefe der Wahrheit hinterher) — dieser
  Kommentar ist übernommen worden;
- `user-select: none` und `overflow: hidden` am `body` — Werkzeugverhalten, nicht Zierde.

---

## 3 · Die Angleichung

### 3.1 Tokens — Terra vorher / nachher

Alle Tokens tragen jetzt **UWEs Namen** (`--uwe-*`), damit ein späterer Themenwechsel
eine Stelle ist und nicht dreißig.

| Rolle | Terra vorher | Terra nachher (Tag / Nacht) |
|---|---|---|
| Grundfläche | `#e9eff3` | `--uwe-bg` `#f1e8d4` / `#100e16` |
| Kartenfläche | `rgba(255,255,255,.84)` | `--uwe-surface` `rgba(251,246,234,.88)` / `rgba(18,16,26,.74)` |
| Kante | `rgba(150,168,186,.34)` | `--uwe-border` `#e0d4ba` / `rgba(225,215,195,.17)` |
| Kantenstärke | `1px` | `--uwe-border-width` `1.5px` |
| Schrift (Fließ) | `#3d4753` | `--uwe-fg` `#211d17` / `#f1e8d4` |
| Schrift (gedämpft) | `opacity:.5–.62` | `--uwe-fg-muted` / `--uwe-fg-subtle` (echte Farben statt Deckkraft) |
| Akzent | `#2d74ab` (Blau) | `--uwe-accent` `#c2622b` / `#e8a670` (Terrakotta) |
| Verweis | `#2d74ab` | `--uwe-link` `#1a5c4f` / `#7fd0b4` (Teal) |
| Warnung | `#a2493a` / `#a34b4b` | `--uwe-danger` `#a8541b` / `#e8a670` |
| Kartenradius | `16px` | `--uwe-radius-card` `14px` |
| Knopfradius | `9px` | `--uwe-radius-btn` `9px` (unverändert — traf schon) |
| Kachelradius | `16px` (Werkzeug) | `--uwe-radius-tile` `12px` |
| Schatten | `0 6px 20px rgba(92,116,140,.13)` | `--uwe-shadow-md` `0 4px 14px rgba(0,0,0,.28)` |
| Weichzeichnung | `blur(9px)` | `--uwe-glass-blur` `blur(13px) saturate(1.05)` |
| Schrift | `"Segoe UI",Roboto,system-ui,…` | `var(--uwe-font-space-mono, ui-monospace), "Cascadia Mono", …, Consolas, monospace` |
| Regler-Spur | `#dbe3ea` | `--uwe-input-bg` (Tinte auf transparent, dreht mit) |
| Fokus | `outline: 2px solid rgba(127,169,204,.45)` | `2px --uwe-focus-ring` + `4px --uwe-focus-shadow`, Felder mit 3 px |
| Abstände | Einzelwerte 5–16 px | `--uwe-spacing-xs…xl` (4/8-Raster) |

**Gedämpfte Schrift statt Deckkraft.** Vorher waren Nebentexte mit `opacity` gesetzt
(`.ph{opacity:.5}`, `.psub{opacity:.62}`, `#stats span{opacity:.5}`). Über einer gemalten
Szene lässt Deckkraft das Bild durchscheinen und die Lesbarkeit hängt am Motiv. Jetzt
tragen sie `--uwe-fg-muted` / `--uwe-fg-subtle` — echte Farben, die mit dem Modus drehen
und über jedem Untergrund gleich bleiben.

### 3.2 Hell/Dunkel — wie Terra es löst

UWE schaltet über Theme-IDs auf `<html>`, geschrieben von der Theme-Engine als
Inline-Style. **Custom Properties erreichen einen Frame aber nicht** — sie vererben nicht
über die Dokumentgrenze. Terra kann UWEs Tokens im eingebetteten Zustand also nicht
einfach „mitlesen".

Die Lösung braucht kein JavaScript. Die Farbwerte stehen in **`light-dark()`**, und die
drei Regeln darunter drehen nur noch `color-scheme` — dasselbe, was UWEs eigene Themes in
`ghibli-shell.css:39/58` tun:

```css
:root { color-scheme: light dark;  --uwe-bg: light-dark(#f1e8d4, #100e16); … }
html[data-uwe-theme="uwe-ghibli-tag"]   { color-scheme: light; }
html[data-uwe-theme="uwe-ghibli-nacht"] { color-scheme: dark; }
```

Daraus ergibt sich:

| Lage | Ergebnis |
|---|---|
| Kein Attribut (Terra allein geöffnet) | folgt der Systemeinstellung |
| Rahmen setzt `data-uwe-theme="uwe-ghibli-tag"` | Tag |
| Rahmen setzt `data-uwe-theme="uwe-ghibli-nacht"` | Nacht |
| Rahmen setzt ein anderes UWE-Theme | Terra bleibt beim hellen Papier (siehe 5.) |

Drei Vorteile gegenüber doppelt gepflegten Farbblöcken: jeder Wert steht **einmal**, das
Vokabular ist UWEs eigenes, und `color-scheme` färbt zusätzlich die **nativen**
Bedienelemente mit — Rollbalken und die aufgeklappten `<select>`-Listen der unteren
Leiste. Die bekommt man mit CSS sonst nicht sauber dunkel.

### 3.3 Zustände, durchgehend

- **Hover** — Rahmen 35 % Akzent, Fläche 12 % Akzent (UWEs Rail-Knopf,
  `uwe-components.css:39-44`). Das vorherige `translateY(-1px)` an `.tool` ist entfallen:
  UWE hebt Karten an, nicht Knöpfe.
- **Aktiv** — `translateY(1px)`, UWEs Druck-Konvention.
- **Gewählt** (`.tool.on`, `.seg button.on`, `#bar button.on`) — Akzentschrift auf
  gedämpfter Akzentfläche mit Akzentkante, fett. Das ersetzt die vorherige
  **Vollfärbung** `background:#2d74ab; color:#fff`. Begründung: ein dauerhaft leuchtender
  Block neben acht ruhigen wäre über der gemalten Szene der lauteste Punkt im Bild;
  UWE markiert den gewählten Navigationseintrag genau so (`ghibli-shell.css:145-153`).
- **Fokus** — sichtbar und einheitlich, `:focus-visible` global; Formularfelder mit
  UWEs schmalerer 3-px-Variante.
- **Deaktiviert** — neu (gab es vorher gar nicht): `opacity:.45`, gedämpfte Kante,
  `cursor:not-allowed`, kein Druckversatz.
- **Bewegung** — `prefers-reduced-motion` **und** `html[data-uwe-motion="off"]`, damit der
  Rahmen die Wahl durchreichen kann.

### 3.4 Ein Fehler, der beim Ansehen auffiel

UWEs Hover- und Auswahl-Waschungen (`accent 12 %`, `--uwe-accent-muted`) sind
**durchsichtig**. In UWE liegen sie auf einer deckenden Seite — in Terra hätten sie als
alleiniger Hintergrund die Papierfläche *ersetzt* und das Bild durchscheinen lassen. Im
Bildschirmfoto „dunkles Panel über heller Szene" war das gewählte Werkzeug **AUSWAHL**
dadurch kaum noch lesbar: hellorange Schrift auf durchscheinendem Wiesengrün.

Behoben durch Auflegen statt Ersetzen — zwei Ebenen in einer `background`-Angabe:

```css
background: linear-gradient(var(--uwe-accent-muted), var(--uwe-accent-muted)), var(--uwe-surface);
```

Das betrifft alle Hover- und `.on`-Regeln. Die Tokens `--uwe-wash-hover`,
`--uwe-wash-hover-stark` und `--uwe-wash-warn` halten die Werte an einer Stelle.

---

## 4 · Wo bewusst abgewichen wurde

1. **Schatten `md` statt `sm`.** UWEs Glaskarte nimmt `--uwe-shadow-sm`
   (`ghibli-shell.css:174`). Terras Karten schweben über einer gemalten Szene mit eigenem
   Kontrast; mit dem 1-px-Schatten verlören sie dort die Kante. Der Wert ist trotzdem
   UWEs eigener (`tokens.ts:172`), kein erfundener.
2. **Grundschriftgrad 13 px statt 14,4 px.** UWEs `--uwe-text-base` ist `0.9rem`. Terra
   ist ein dichtes Werkzeug mit einem 250-px-Panel; die Laufschrift ist ohnehin breiter
   als die vorherige Fließschrift. 13 px hält den Umbruch im Panel dort, wo er war —
   nachgemessen: kein Überlauf (`scrollWidth == clientWidth == 248`).
3. **Untere Leiste enger als das Raster** (`gap: 6px`, Knöpfe `11.5px`). Die Leiste trägt
   rund zwanzig Bedienelemente; mit dem vollen 8-px-Raster bräche sie eine Zeile früher um.
4. **Keine 44-px-Mindestgröße.** UWE ist „mobile-first" mit `--uwe-touch-target: 44px`
   (`ghibli-shell.css:34`). Terra ist ein Zeigegerät-Werkzeug — ein Kartendeitor mit
   Ziehen, Rechtsklick-Schwenken und Mausrad. Die Knöpfe bleiben bei ~26–32 px. Das ist
   die deutlichste Abweichung und sollte revidiert werden, falls Terra je auf Tablets soll.
5. **Serifenschrift nur an einer Stelle.** UWE gibt `h1/h2` und Kartentitel an Newsreader
   (`ghibli-shell.css:82-88`). Terra hat keine einzige echte Überschrift — die `.ph` sind
   „Eyebrows" (Großbuchstaben, weite Laufweite) und tragen in UWE ebenfalls die UI-Schrift.
   Serif steht deshalb nur am Kopf des Fehlerbilds `#fail b`.
6. **Kein `--uwe-btn-bg`-Knopf im Bestand.** UWEs Primärknopf ist eine Tintenfüllung
   (`README.md:122`). Keiner von Terras Knöpfen hat heute diese Rolle; die Regel
   `button.wide.primaer` steht bereit, wird aber nicht vergeben (siehe 5.).

### Reibungspunkte zwischen Terras Kunstrichtung und UWEs Marke

Praktisch keine — das war das Geschenk dieses Auftrags. UWEs Signaturthema **ist** ein
Ghibli-Redesign („Gemalte Welt"), entworfen für Chrome über einer gemalten Landschaft,
mit gedämpfter Sättigung, warmem Papier und kühlen Schatten. Zwei Stellen reiben leicht:

- **Terrakotta über Grün.** Der Studio-Akzent `#c2622b` ist ein warmer Rotton; Terras
  Standardszene ist eine grüne Wiese. Das ist eine Gegenfarbe, kein Konflikt — der Akzent
  verschwindet nicht in der Landschaft, sondern steht heraus. In der Aschebrache und im
  Vulkanbiom (rot-brauner Grund) wird er dagegen weniger deutlich. Die Kante hält ihn
  zusammen, aber es lohnt ein Blick auf diese Biome auf echter Hardware.
- **Warnfarbe = Akzentfarbe im Nachtmodus.** `--uwe-danger` und `--uwe-accent` fallen
  nachts beide auf `#e8a670` (`themes-ghibli.ts:73, 77`). Das ist UWEs eigene Entscheidung,
  nicht ein Fehler hier; in Terra trennt nur die Kantenfarbe „Karte löschen" vom
  gewählten Werkzeug. Falls das zu wenig ist, wäre eine eigene Nacht-Warnfarbe eine
  Änderung **in UWE**, nicht in Terra.

---

## 5 · Was im JavaScript nachzuziehen ist

Nichts davon ist für die Angleichung zwingend — das Stylesheet steht für sich. Es sind
die Stellen, an denen ein kleiner Eingriff spürbar mehr bringt.

### 5.1 Marker-Beschriftungen tragen ihre Gestaltung inline — **das ist die wichtige**

`terra/src/ui/panels.js:1070-1090`, Funktion `markerLabelNeu()`, setzt die vollständige
Gestaltung des HTML-Overlays als Inline-Style. Inline schlägt jede Stylesheet-Regel,
**diese Beschriftungen sind deshalb als einzige Stelle noch im alten Blaugrau** und
drehen auch nicht mit dem Modus:

| Zeile | heute | sollte werden |
|---|---|---|
| `panels.js:1077` | `s.font = "600 11.5px/1.35 \"Segoe UI\",…"` | *entfällt* (erbt aus der Klasse) |
| `panels.js:1078` | `s.color = "#3d4753"` | *entfällt* |
| `panels.js:1079` | `s.background = "rgba(255,255,255,.84)"` | *entfällt* |
| `panels.js:1080` | `s.border = "1px solid rgba(150,168,186,.34)"` | *entfällt* |
| `panels.js:1081` | `s.borderRadius = "9px"` | *entfällt* |
| `panels.js:1083` | `s.boxShadow = "0 4px 14px rgba(92,116,140,.16)"` | *entfällt* |
| `panels.js:1084` | `s.backdropFilter = "blur(9px)"` | *entfällt* |

**Vorschlag:** in `markerLabelNeu()` nach `var d = document.createElement("div");` ein
`d.className = "markerLabel";` einfügen und die sieben Zeilen oben streichen. Position,
`transform`, `whiteSpace`, `maxWidth`, `overflow`, `textOverflow` und `pointerEvents`
bleiben inline — sie sind Mechanik, nicht Gestaltung.

Zwei weitere Stellen in `markerOverlayAktualisieren()` setzen Farben je Bild:

- `panels.js:1138` — `d.style.borderLeft = "3px solid " + ton` (Markerart-Farbe aus
  `MARKER_TON`, `panels.js:1051`). Diese vier Farben sind Terras eigene Sachfarben
  (Ort/Gefahr/Notiz/Arbor) und **sollen bleiben** — sie bedeuten etwas.
- `panels.js:1142-1143` — `d.style.background` und `d.style.color` für den gewählten
  Marker. **Vorschlag:** stattdessen `d.classList.toggle("aktiv", aktiv)`.

Die passenden Regeln stehen noch **nicht** in `style.css` — ich habe sie bewusst
weggelassen, weil eine Regel ohne die Klasse, die sie trifft, toter Code wäre. Sobald die
Klasse vergeben ist, gehören sie dazu:

```css
.markerLabel {
  font: 700 var(--uwe-text-xs)/1.35 var(--uwe-font-family);
  color: var(--uwe-fg);
  background: var(--uwe-surface);
  border: var(--uwe-border-width) solid var(--uwe-border);
  border-radius: var(--uwe-radius-btn);
  box-shadow: var(--uwe-shadow-sm);
  backdrop-filter: blur(var(--uwe-glass-blur));
}
.markerLabel.aktiv { background: var(--uwe-bg-elevated); color: var(--uwe-accent); }
```

### 5.2 Die Tageszeit könnte den Modus mitnehmen

Terra weiß bereits, ob es Tag oder Nacht ist — die untere Leiste schaltet
Morgen/Mittag/Abendrot/Nebel/Nacht. Der einzige Zusammenlauf ist
**`terra/src/world/atmosphere.js:632`, Funktion `setTod(name, instant)`**; die dortige
Schleife (`:643-644`) setzt schon die `.on`-Klasse der Knöpfe.

**Vorschlag** — eine Zeile ans Ende von `setTod`:

```js
// Die Bedienoberflaeche folgt der Szene: nachts das dunkle Theme des Paars.
if (typeof document !== 'undefined')
  document.documentElement.dataset.uweTheme =
    (name === 'nacht') ? 'uwe-ghibli-nacht' : 'uwe-ghibli-tag';
```

Damit dunkelt das Panel mit der Szene ab, ohne dass jemand etwas umschaltet. **Achtung —
Vorrangfrage:** im eingebetteten Zustand sollte der Rahmen gewinnen, nicht Terras
Tageszeit. Wenn UWE das Attribut selbst setzt, darf `setTod` es nicht überschreiben. Ein
Wächter (`if (!window.frameElement)`) oder ein eigenes Attribut wäre die saubere Lösung —
das ist eine Entscheidung, keine Kleinigkeit, deshalb steht hier nur der Vorschlag.

Ohne diesen Eingriff ist nichts kaputt: beide Kreuzfälle wurden geprüft und sind
lesbar (Abschnitt 6).

### 5.3 Kleinere Anregungen

- **`terra/src/ui/panels.js`** — dem Knopf „Gelände erodieren" die Klasse
  `wide primaer` statt nur `wide` geben, falls er als Hauptaktion des Panels gelten soll.
  Die Regel steht bereits in `style.css`.
- **`terra/index.html:40-139`** — die untere Leiste legt Beschriftung und Bedienelement
  als **getrennte** Flex-Kinder ab. Beim Umbruch reißt das Paar auseinander; im Bild
  steht „Wetter" am Ende der ersten Zeile und sein Auswahlfeld am Anfang der zweiten.
  Ein Wrapper je Paar würde das beheben:
  `<span class="grp"><label …>Wetter</label><select …></span>` mit
  `.grp{display:inline-flex;align-items:center;gap:6px}`. Ich habe es **nicht** gebaut —
  es ist Aufbau, nicht Gestaltung, und an `index.html` arbeitet jemand parallel.

---

## 6 · Geprüft

**Testlauf** — `node --test terra/test`: **423 bestanden, 0 fehlgeschlagen**, 1
übersprungen (`Ebene 5 — Schemaschluessel gegen Generatorparameter`, mit dem Vermerk
„editor/tools.js wird parallel bearbeitet"; die Übersprungenheit besteht unabhängig von
dieser Arbeit). Der Zweig führt inzwischen 424 statt der genannten 408 Tests.

**Browserprüfung** — Playwright gegen den statischen Server auf Port 8123, WebGL über
SwiftShader, 1240 × 780. Aufgenommen und beurteilt:

| Bild | Ergebnis |
|---|---|
| Werkzeugleiste, Tag | Gewähltes Werkzeug klar in Terrakotta, Tastenziffern lesbar |
| Panel mit Reglern (Werkzeug „Pfad") | Griffe in Akzentkante, Knopfgruppe mit gewähltem und **deaktiviertem** Eintrag |
| Panel Karten/Erosion/Biome/Namen („Auswahl" ohne Auswahl) | Abschnitte, Fließtext, Fortschritt, breite Knöpfe — kein Überlauf |
| Untere Leiste, Ruhe und Hover | Hover-Waschung und Akzentkante deutlich |
| Toast | Papierkarte mit Tintenschrift, mittig oben |
| Hinweiszeile | Hervorhebungen in Akzent |
| Fokus per Tastatur | Ring sichtbar, 2 px Akzent + Schein |
| **Nacht-Theme über Nachtszene** | Tinte-Panel, Laternen-Akzent, voll lesbar |
| **Kreuzfall: helles Panel über Nachtszene** | lesbar — Papier deckt genug |
| **Kreuzfall: dunkles Panel über Tagszene** | lesbar (nach der Korrektur aus 3.4) |

Der Panel-Überlauf wurde bei jedem Lauf gemessen: `scrollWidth == clientWidth == 248` in
allen vier Kombinationen, kein Element ragt heraus.

---

## 7 · Was ich nicht beurteilen konnte

- **Die Bildwirkung auf echter Hardware.** WebGL lief in Software (~1 Bild/s). Für die
  Bedienoberfläche reicht das — sie ist normales DOM —, aber wie `backdrop-filter:
  blur(13px) saturate(1.05)` über einer *bewegten* Szene wirkt und was er auf einer
  echten Grafikkarte kostet, muss ein Mensch mit GPU beurteilen. Terras eigene
  Browser-README sagt dasselbe (`terra/test/browser/README.md`, Abschnitt „Was auch das
  nicht leistet").
- **Die eingebettete Lage.** Terra lief allein unter `localhost:8123`, nicht als Frame in
  Studio. Ob der Rahmen `data-uwe-theme` bis ins Frame-Dokument durchreicht, ist eine
  Frage der Einbettung und dort noch nicht entschieden.
- **Der echte Webfont.** Ohne Space Mono greift `ui-monospace` (unter Windows Cascadia
  Mono/Consolas). Die Zeilenumbrüche im 250-px-Panel wurden **mit Consolas** gemessen.
  Space Mono ist merklich breiter — reicht der Rahmen die Schrift irgendwann durch, muss
  der Panelumbruch neu angesehen werden.
- **Die übrigen 24 Biome.** Beurteilt wurde über „Wiese" (grün) und der Nachtszene.
  Aschebrache, Vulkan und Ewiges Eis haben deutlich andere Grundtöne (siehe 4.).
- **Andere UWE-Themes.** Setzt der Rahmen z. B. `uwe-parchment-os` oder `dark-fantasy`,
  bleibt Terra beim hellen Papier. Deren Tokens stehen als Inline-Style auf dem `<html>`
  des Rahmens und erreichen den Frame nicht. Das ist eine bewusste Grenze, kein Versehen —
  aber sie sollte bekannt sein, falls jemand die Themenwahl im Frame erwartet.
- **Der Handoff selbst.** `design_handoff_ghibli_redesign/README.md` wird an drei Stellen
  referenziert (`themes-ghibli.ts:7`, `auth/uwe-landing.css:3`, `UweLandingPage.tsx:24`),
  liegt aber nicht im Repo. Alle Werte hier stammen aus der Rekonstruktion in
  `themes-ghibli.ts`. Falls das Original auftaucht, lohnt ein Abgleich.
