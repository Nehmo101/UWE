# Terra: Umstellung von Three.js auf Godot (+ MCP) — Analyse

> **Reine Analyse.** An Terra, den Apps oder der CI wurde für diesen Bericht
> keine Zeile geändert. Stand: 02.08.2026, Branch
> `claude/terra-threejs-godot-mcp-v23fj8`, Basis `b0fd032`.
>
> Vorbild für Form und Anspruch ist
> [`terra-runde-j-atlas-abbau.md`](terra-runde-j-atlas-abbau.md) — erst
> inventarisieren, dann entscheiden.

---

## 0. Zusammenfassung in fünf Sätzen

Terra ist heute ~48.000 Zeilen Three.js-Generatoren plus ~17.400 Zeilen
abhängigkeitsfreier Node-Tests, eingebettet als gleich-origin `<iframe>` mit
einer sorgfältig abgesicherten `postMessage`-Brücke. Die **Einbettung, das
Datenformat, der Freigabe-Workflow und der KI-Weg sind engine-unabhängig** —
sie würden eine Umstellung überleben. Was **nicht** überlebt, ist praktisch der
gesamte Wert: Generatoren, Look und die komplette Testpyramide. Dazu kommen
vier harte technische Befunde, von denen zwei (CSP/WASM und
Cross-Origin-Isolation) direkt mit bestehenden UWE-Zusagen kollidieren. Und
der in `terra/README.md` genannte Anlass — 3–4 fps bei ~200k Dreiecken — ist
laut derselben README **ausdrücklich noch nicht aufgeklärt**; ein
Engine-Wechsel gegen eine ungeklärte Ursache ist der teuerste denkbare
Diagnoseversuch.

**Empfehlung:** nicht umstellen. Stattdessen (1) den Performance-Befund in
einer Stunde klären, (2) Godot — falls überhaupt — als *zweiten* Renderer
hinter dem bestehenden v5-Format spiken, nicht als Ersatz, (3) die MCP-Frage
komplett getrennt bewerten, sie hat mit dem Renderer nichts zu tun.

---

## 1. Die Frage hat zwei Lesarten, und sie sind verschiedene Projekte

„Terra Three.js → Godot MCP" kann zweierlei heißen. Die Unterscheidung ist
nicht akademisch — die beiden Vorhaben teilen kein einziges Artefakt.

**Lesart A — Laufzeit-Umstellung.** Der Karteneditor wird ein Godot-Projekt,
per Web-Export (WASM) ausgeliefert, im selben `<iframe>` eingebettet. MCP
kommt hinzu, damit Agenten Welten erzeugen können. Das ist ein
Neuschreiben von Terra.

**Lesart B — Autorenwerkzeug.** Ein Godot-MCP-Server (die bekannten
Community-Server steuern den Godot-*Editor*: Projekt starten, Szene anlegen,
Debug-Ausgabe holen) läuft auf dem Entwicklungsrechner, damit ein Agent das
Godot-Projekt bauen kann. Das ist ein Werkzeug für die Entwicklung, kein
Bestandteil einer UWE-Installation.

Lesart B ist nur sinnvoll, *wenn* Lesart A stattfindet — es gibt sonst kein
Godot-Projekt zu steuern. Der Rest dieses Berichts bewertet deshalb vor allem
A, und behandelt B in [§ 7](#7-die-mcp-frage-gehört-nicht-zum-renderer)
gesondert.

---

## 2. Bestandsaufnahme: was Terra heute ist

### 2.1 Umfang

| Bereich | Zeilen | Anmerkung |
|---|---:|---|
| `terra/src/generators/` | 19.174 | Kern: `geometry.js` allein 5.796 |
| `terra/src/world/` | 7.902 | Terrain, Biomfeld, Atmosphäre, Wasser, VFX |
| `terra/src/editor/` | 6.089 | Werkzeuge, Historie, IO, Brücke |
| `terra/src/assets/` | 4.334 | Architektur-Katalog, Luftinseln, Steampunk-Flotte |
| `terra/src/render/` | 4.219 | Pipeline, Materialien, Signaturen, Texturen |
| `terra/src/ui/` | 3.266 | Bedienfelder, Beschriftung, CSS |
| `terra/src/core/` | 2.489 | Store, RNG, Pools, Dirty-Tracking |
| **`terra/src` gesamt** | **47.884** | 69 Dateien, alle `.js` |
| `terra/test/` | 17.423 | ~40 Testdateien + Fixtures + Stubs |
| `terra/vendor/` | 2,1 MB | three 0.185.1, **unverändert vendored** |
| `terra/assets/` | 104 KB | |
| Design-Docs `docs/engineering/terra-*.md` | 4.529 | 10 Dokumente |

Wichtige Korrektur am Bestand: `terra/README.md:3-5` behauptet, Three komme
„von jsDelivr" per CDN. Das stimmt nicht mehr — `terra/index.html:27-34`
zeigt eine Import-Map auf `./vendor/three/three.module.js`, und
`terra/vendor/HERKUNFT.md` hält fest: geholt am 27.07.2026, Byte für Byte
unverändert. **Terra läuft heute vollständig offline.** Für ein
selbstgehostetes System ohne Cloud-Abhängigkeit ist das keine Kleinigkeit,
sondern genau die Eigenschaft, die UWE sich sonst überall erarbeitet.

### 2.2 Auslieferung

`scripts/copy-terra.mjs` kopiert `index.html`, `src`, `vendor`, `assets` nach
`apps/studio/public/terra` und `apps/portal/public/terra` (pre-dev/pre-build,
Zielordner sind gitignorete Build-Artefakte). Der Kopfkommentar des Skripts
begründet das ausführlich: Terra **muss** gleich-origin ausgeliefert werden,
in *beiden* Apps, weil die CSP `frame-src 'self'` setzt und die Brücke
`event.origin === location.origin` prüft. Zwei eingecheckte Kopien wären bei
4 MB und laufender Weiterentwicklung der Fehler.

Kein Bundler, kein Build-Schritt. Das ist eine bewusste Zusage, keine
Nachlässigkeit.

### 2.3 Einbettung und Sicherheitsmodell

`terra/src/editor/bruecke.js` (386 Zeilen) formuliert das Modell im
Kopfkommentar so klar, dass es zitiert gehört:

> Der Frame ist ein reiner Renderer. Alles reist über `postMessage`, und jeder
> Schreibvorgang läuft anschließend durch die Server Actions der Elternseite —
> mit deren vollem Rechte-Trio (CSRF/Origin → Rolle → gehört die Karte zur
> Welt). Der Frame kann davon nichts umgehen: er besitzt keine Route, keine
> Sitzung und kein Schreibrecht.

Geprüft wird **beides**: `event.origin === location.origin` *und*
`event.source === window.parent` — Herkunft allein genügt nicht, weil jeder
andere Frame derselben Herkunft sonst Karten hereinschieben könnte. Beim
Senden ist das Ziel immer `location.origin`, nie `"*"`.

In `packages/auth/src/security-headers.ts` stehen dafür vier tragende,
namentlich für Terra kommentierte Ausnahmen:

- `frame-ancestors 'self'` (Zeile 83) — „Required by the Terra editor frame —
  do not tighten to 'none'."
- `frame-src 'self'` (Zeile 67) — „Load-bearing, not decorative."
- `X-Frame-Options: SAMEORIGIN` (Zeile 152) — „DENY would blank the frame."
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy:
  same-origin` (Zeilen 154-155).

### 2.4 Daten

`TerraKarte` (`packages/database/prisma/schema.prisma:2710 ff.`):

- `daten Json` — Kartenbaum im **Terra-Format v5**
  (`{ format, version, wurzel, karten[] }`)
- `version Int` — optimistische Sperre; die Version reist über die Brücke in
  beide Richtungen mit, ein Schreiben mit veralteter Version wird abgelehnt.
  Zwei offene Reiter löschen sich so nicht gegenseitig.
- `status`, `autorUserId`, `autorName`, `eingereichtAm`, `entschiedenAm`,
  `entschiedenVonUserId` — der **Spieler-Entwurfs-Workflow**: Spieler legen im
  Portal Karten an, reichen sie ein, der Spielleiter nimmt ab oder gibt mit
  Rückmeldung zurück. `autorUserId` ist der Besitznachweis und wird im `where`
  verglichen, nicht davor.

Migrationen: `20260727120000_terra_karten`,
`20260729120000_terra_spieler_entwuerfe` (SQLite und PostgreSQL).

Ältere Formate v1–v4 laden weiter; `world/kartenbaum.js` normiert sie,
Fixtures dafür liegen in `terra/test/fixtures/`.

### 2.5 KI-Weg (existiert bereits)

Es gibt heute schon einen validierten KI-Pfad in Terra hinein:

1. `packages/ai-brain/src/proposal-validators/terra-world-draft.ts` — die
   Brain-Aktion `terra_world_draft` liefert einen **geprüften** Parametersatz.
2. `apps/studio/src/components/terra/brain-lauf.ts` — startet den Lauf über
   `POST /api/brain/run`, pollt `/api/jobs/:id`. Provider fest `ollama` /
   `llama3.2`, also lokal, wie es die Hausregel verlangt.
3. Die Brücke schickt `{ typ: "welt-vorgabe", vorgabe, laufId, seed }`.
4. **Der Frame prüft den Parametersatz noch einmal** (`generators/
   welt-vorgabe.js` klemmt die Werte) und baut dann die Welt. Die `laufId`
   wandert in den Herkunftsvermerk der Karte — der Prompt selbst nicht.

Zweifache Validierung, lokales Modell, Nachvollziehbarkeit über die Lauf-Id.
Das ist bereits ein besserer KI-Weg, als ein Editor-steuerndes MCP ihn böte.

### 2.6 Tests

`pnpm test:terra` = `node --test terra/test/`, eingehängt in `test`,
`test:ci` **und** `test:ci:affected` (`package.json:23,24,32,58`).

`terra/test/README.md` nennt die fünf geprüften Zusagen: Determinismus,
Formatkompatibilität, Generator-Invarianten, Shader-Anker,
Registry-Konsistenz. Und den Preis, den man dafür *nicht* zahlt (Zeile 27):

> Keine Abhängigkeiten, kein Build-Schritt, kein pnpm-Workspace — nur der in
> Node eingebaute Testläufer.

Möglich wird das durch `terra/test/hilfen/three-stub.mjs`: eine
handgeschriebene, deterministische Nachbildung genau der Three-Teilmenge, die
Terra außerhalb des Browsers benutzt. Der Stub erzeugt **echte Vertexdaten**
nach denselben Formeln wie Three — „nur so haben Aussagen wie ‚kein NaN in
Position/Normale/UV' oder ‚Dreieckszahl je Pool' Gewicht". Die Shader-Anker
werden bewusst *nicht* gegen den Stub geprüft, sondern gegen die gepinnte
Three-Quelle (`hilfen/three-quelle.mjs`, Anker in
`fixtures/three-0.185.1-anker.json`).

Nebenbefund: `terra/` liegt außerhalb des Anti-Monolith-Wächters —
`scripts/file-size-budget-check.mjs` scannt nur `apps`, `packages`, `tools`
und nur `.ts`/`.tsx`. Deshalb darf `geometry.js` 5.796 Zeilen haben. Das ist
heute geduldet; für neuen Code in `tools/` oder `packages/` gälte die
700-Zeilen-Regel wieder.

---

## 3. Was eine Umstellung überleben würde

Die gute Nachricht zuerst, weil sie den Zuschnitt eines möglichen Vorgehens
bestimmt. Diese Teile sind **engine-unabhängig**:

| Artefakt | Warum es bleibt |
|---|---|
| Format v5 (`TerraKarte.daten`) | JSON, kennt kein Three |
| Optimistische Sperre (`version`) | Vertrag zwischen Eltern und Frame |
| Spieler-Entwurfs-Workflow | Prisma + Server Actions, kein Renderer-Bezug |
| `postMessage`-Vertrag | Godot kann per `JavaScriptBridge` senden/empfangen |
| Rechte-Trio, CSRF, Welt-Zuordnung | liegt vollständig in der Elternseite |
| `copy-terra.mjs`-Muster | Ziel wäre nur ein anderer Ordnerinhalt |
| Die 10 Design-Docs (4.529 Zeilen) | Biom-, Objekt-, Signaturenkatalog sind Absicht, nicht Code |

**Das ist der Kernbefund für den Zuschnitt:** der teure, sicherheitskritische
Teil der Integration ist *nicht* der Teil, den man neu schreiben müsste. Wer
umstellt, tauscht den Renderer und die Generatoren — nicht die Einbettung.
Daraus folgt unmittelbar, dass eine Umstellung *nicht* als Ersetzung
stattfinden muss (siehe [§ 9](#9-empfehlung)).

---

## 4. Was neu geschrieben werden müsste

Alles andere. Konkret:

- **19.174 Zeilen Generatoren.** Deterministische, ortsstabil gehashte
  Erzeugung; 272 Objekt-Pools; 25 Biome mit eigenen Höhenprofilen;
  Struktur-Generatoren (Burg, Werft, Kloster, Blattstadt mit Gassennetz in
  Blattkoordinaten); Wegsuche; Weltschildkröte samt Kopf.
- **Die Bildsprache.** Ghibli-Bildaufbau, Wrap-Licht mit kühlen Schatten,
  niederfrequente Farbdrift, Godrays, Papierkante, gemalte Wasserstreifen,
  Multiplane-Tiefenbänder, bildraumfeste Malschicht, Palettenbindung. Das
  lebt in GLSL und im Three-Material-System plus `EffectComposer` /
  `UnrealBloomPass`. Godots Shader-Sprache ist verwandt, aber nicht gleich;
  Nachbearbeitung liefe über `WorldEnvironment` und eigene Viewport-Shader.
  Realistisch wird der Look **neu hergeleitet, nicht portiert** — Kalibrierung
  inklusive (die Kommentare zu `satMitte` in Runde F zeigen, wie fein das
  eingestellt wurde).
- **17.423 Zeilen Tests** samt Stub, Anker und v1–v4-Fixtures.
- **Die Rückwärtskompatibilität.** v1–v4 laden heute noch. Ein Godot-Renderer
  müsste dieselbe Normierung mitbringen, sonst verlieren Bestandskarten ihre
  Lesbarkeit — und in der Datenbank stehen sie als `Json`, nicht als etwas,
  das ein Migrationsskript zuverlässig in ein Godot-Szenenformat hebt.

Größenordnung, ausdrücklich keine Punktschätzung: Terra hat für diesen Stand
die Runden C bis J samt mehrerer Wellen gebraucht — in der Git-Historie über
Monate sichtbar (`#41`, `#46`, `#47` sind allein die letzten drei
Terra-Commits). Eine gleichwertige Godot-Fassung ist ein Vorhaben derselben
Größenordnung, nicht ein Refactor.

---

## 5. Vier harte technische Befunde

Diese vier sind nicht „Aufwand", sondern Kollisionen mit Zusagen, die UWE
heute einhält.

### 5.1 Die CSP verbietet WASM in Produktion — und *nur* dort

`packages/auth/src/security-headers.ts:50-53`:

```ts
const scriptSrc = ["'self'", "'unsafe-inline'"];
if (!isProductionEnv(env)) {
  scriptSrc.push("'unsafe-eval'");
}
```

Chrome verlangt bei gesetztem `script-src` für die WASM-Kompilierung
`'wasm-unsafe-eval'` (oder das viel breitere `'unsafe-eval'`).
`'unsafe-inline'` genügt **nicht**.

Daraus folgt das unangenehmste Fehlerbild, das es gibt: **im Dev-Zweig läuft
Godot (dort steht `'unsafe-eval'`), in Produktion bleibt der Frame schwarz.**
Der Unterschied fällt erst nach dem Deploy auf.

Die Behebung wäre `'wasm-unsafe-eval'` in `script-src` — sachlich die
schmalste WASM-Freigabe, die es gibt, und deutlich enger als `'unsafe-eval'`.
Trotzdem eine CSP-Aufweichung, und CLAUDE.md sagt dazu: „CSP nicht ohne Review
schwächen." Das ist machbar, aber es ist eine bewusste Entscheidung, kein
Nebeneffekt.

### 5.2 Threads brauchen Cross-Origin-Isolation — und die bricht zwei Features

Godots Web-Export nutzt für Threads `SharedArrayBuffer`. Der ist nur
verfügbar, wenn das Dokument **cross-origin-isoliert** ist:
`Cross-Origin-Opener-Policy: same-origin` **plus**
`Cross-Origin-Embedder-Policy: require-corp` (oder `credentialless`).

Stand heute:

- COOP `same-origin` ✔ ist bereits gesetzt (Zeile 154).
- **COEP ist überhaupt nicht gesetzt.** Es müsste dazukommen.

Und hier liegt die Falle: Ein `<iframe>` ist nur dann isoliert, wenn **auch
das oberste Dokument** isoliert ist. Man kann COEP also *nicht* auf
`/terra/*` beschränken — Studio und Portal selbst müssten isoliert werden.
Unter `require-corp` muss dann jede fremde Subressource per CORP/CORS
zustimmen. Zwei bestehende Ausnahmen stehen genau dort im Weg:

- **YouTube-Einbettungen** (`frame-src https://www.youtube.com`,
  `https://www.youtube-nocookie.com`, Zeile 69)
- **Cloudflare Turnstile** (Skript, `connect-src` und `frame-src`, Zeilen
  55/60/72) — also der Menschen-Check auf dem Anmeldeformular.

Beide senden keine COEP-/CORP-Zusage. Unter Cross-Origin-Isolation ist mit
Ausfällen zu rechnen; `credentialless` mildert das für Subressourcen, für
Frames aber nicht zuverlässig.

**Der Ausweg** ist Godots einfädiger Web-Export (seit 4.3 ohne
`SharedArrayBuffer` möglich). Damit entfällt COEP komplett — zum Preis
spürbar geringerer Leistung. Was uns direkt zu [§ 8](#8-der-eigentliche-anlass-ist-nicht-aufgeklärt)
führt: wenn Leistung der Anlass war, ist der einzige Weg, der die
Sicherheitsarchitektur unangetastet lässt, ausgerechnet der langsame.

### 5.3 Auslieferungsgröße

Ein Godot-4-Web-Export liegt auch für ein triviales Projekt bei grob
25–40 MB (`.wasm` + `.pck`), gegenüber Terras 2,1 MB Vendor plus ~250 KB
Quelltext. Im LAN belanglos. Über einen Cloudflare-Tunnel an einem
Heimanschluss ist es ein neuer Erstlade-Charakter — und für das Portal, das
Spieler von außen benutzen, der spürbarere Fall.

Nebenwirkung: `.wasm` braucht den korrekten MIME-Typ `application/wasm` und
sinnvollerweise Vorkompression. Die Zusage aus `bruecke.js` („per Doppelklick
auf `terra/index.html` laufen") ist damit endgültig nicht mehr zu halten;
schon heute ist sie fragil, weil ES-Module über `file://` blockiert sind.

### 5.4 Die Testpyramide hat kein Godot-Äquivalent zum gleichen Preis

Das ist der teuerste der vier Punkte, und er wird gern übersehen.

Terras Tests laufen, **weil** der Quelltext schlichte ES-Module sind, die Node
importieren kann. Die 17.423 Zeilen prüfen Determinismus, Formatmigration,
Invarianten und Shader-Anker — ohne Browser, ohne GPU, ohne Installation, in
Sekunden, in jeder CI-Umgebung.

In Godot lebt die Erzeugung in GDScript (oder C#) **innerhalb der Engine**.
`node --test` erreicht sie nicht. Der Ersatz wäre GUT oder gdUnit4 gegen eine
headless Godot-Binärdatei. Konsequenzen für dieses Repo:

- Der CI-Runner braucht Godot-Binärdatei **und** Export-Templates
  (Größenordnung 1 GB) — bei drei Einhängepunkten in `package.json`.
- `pnpm test:terra` wird von „null Abhängigkeiten" zu „fremde Toolchain".
- Der Shader-Anker-Test (gepinnte Three-Quelle als Referenz) hat in Godot
  keine Entsprechung; Godots Renderer ist nicht als Quelle versioniert, die
  man ankern könnte.
- Determinismus über Engine-Versionen hinweg ist in Godot schwerer zuzusagen
  als über einen selbst geschriebenen 30-Zeilen-RNG.

---

## 6. Der Präzedenzfall: Atlas 3D → Terra

Dieses Repo hat einen Engine-Wechsel **bereits durchgeführt** und ihn auf
1.065 Zeilen protokolliert (`terra-runde-j-atlas-abbau.md`, erledigt am
27.07.2026, Migration `20260727150000_drop_atlas3d`). Zwei Befunde daraus
sind für jedes künftige Vorhaben dieser Art einschlägig — der erste mit einer
Entwarnung, die man nur durch Nachsehen bekommt:

1. **`packages/backup` sichert nur namentlich gelistete Modelle.**
   `BackupData` zählte damals 22 Sektionen auf, `collect.ts` ruft hartkodierte
   `db.<model>.findMany()`. Kein DMMF-Durchlauf. Die Atlas-Modelle fielen
   heraus, und **es fiel niemandem auf**, weil der einzige
   Vollständigkeitstest (`brain-export.test.ts`) nur die Brain-DB bewacht.
   **Für Terra ist die Lehre gezogen worden — nachgeprüft, Entwarnung.**
   `TerraKarte` ist vollständig erfasst: `collect.ts:566`
   (`db.terraKarte.findMany()`), `types.ts:265` (`BackupTerraKarteRecord`),
   `:551` in `BackupData`, `:19` in den Manifest-Stats, Rückweg in
   `restore.ts:654,663`, und Tests in `backup.test.ts:293,294,371` —
   einschließlich eines Spieler-Entwurfs. Der Kopfkommentar `types.ts:259-263`
   nennt den Grund beim Namen:

   > Diese Sektion existiert, weil der Vorgänger sie NIE hatte: `packages/backup`
   > kannte kein einziges seiner sechs Modelle […] und niemandem fiel es auf
   > […]. Sein Löschen war dadurch unumkehrbar. Terra soll denselben Fehler
   > nicht wiederholen.

   Das Protokoll von damals hat also gewirkt. Für ein künftiges Vorhaben bleibt
   die Prüffrage trotzdem stehen — sie ist nur diesmal schon beantwortet.
2. **Schema-Drift SQLite ↔ PostgreSQL** wurde beim Atlas-Abbau erst spät
   entdeckt. Die Terra-Migrationen existieren in beiden Zweigen (siehe § 2.4)
   — das ist diesmal in Ordnung, sollte aber bei jedem Modell-Eingriff erneut
   geprüft werden.

Der Wert dieses Dokuments liegt genau darin: der Abbau war teurer als der
Aufbau vermuten ließ, und die Kosten lagen an Stellen, an die vorher niemand
gedacht hatte.

---

## 7. Die MCP-Frage gehört nicht zum Renderer

`@uwe/mcp` ist heute bewusst eng geschnitten: vier Server entlang der
Produktgrenzen (Studio, Portal, Brain, Family), **HTTP-Clients über die
bestehenden APIs, kein DB-Zugriff**, stdio, Rechte über die Scopes des
API-Tokens. Der Kopfkommentar in `servers.ts` begründet die Vierteilung mit
`@uwe/product-contracts` und damit, dass Brain und Family einzeln zuschaltbar
sein müssen.

Ein Godot-MCP-Server passt in dieses Muster **nicht**:

- Er steuert einen *Editor auf einem Entwicklungsrechner*, nicht ein
  UWE-Produkt. Es gibt keine Produktgrenze, an der er hinge, und kein
  API-Token, dessen Scopes ihn begrenzten.
- Er gehörte nach `tools/` — analog zu `tools/uwe-rtx-connector` — und wäre
  ein Entwicklungswerkzeug, das eine UWE-Installation nie ausführt.
- Mit der Hausregel „jede KI-Aktion über den RTX-Host, kein Cloud-Provider"
  ist er vereinbar, weil er lokal läuft. Aber er ist damit auch kein
  Fortschritt für das Produkt, sondern für die Entwicklung.

**Und für das Produktziel „KI erzeugt Welten" ist er schlicht überflüssig:**
dieser Weg existiert bereits (§ 2.5), läuft lokal, wird zweifach validiert und
liegt innerhalb des Rechtemodells. Ein Editor-steuerndes MCP läge außerhalb.

Fazit: Die MCP-Frage ist **orthogonal**. Sie kann unabhängig bewertet werden
und liefert kein Argument für oder gegen einen Engine-Wechsel.

---

## 8. Der eigentliche Anlass ist nicht aufgeklärt

`terra/README.md:120-124`, letzter Punkt unter „Offener Stand":

> Ungeklaerte Performance-Frage aus der Einzeldatei-Zeit: 3-4 fps bei nur
> ~200k Dreiecken deuten auf fehlende GPU-Beschleunigung der Testumgebung.
> Pruefung ueber `WEBGL_debug_renderer_info` (steht dort llvmpipe oder
> SwiftShader, liegt es an der Umgebung); **vor dieser Klaerung keine weitere
> GPU-Optimierung investieren.**

200k Dreiecke sind für jede halbwegs aktuelle GPU nichts. 3–4 fps bei dieser
Last ist das Signalbild eines **Software-Rasterizers** (llvmpipe unter Linux
ohne Treiber, SwiftShader wenn Chrome die GPU auf die Sperrliste gesetzt hat)
— nicht das einer zu langsamen Rendering-Bibliothek.

Falls das zutrifft, ist der Befund für die Godot-Frage vernichtend: **Godots
Web-Export liefe durch denselben Software-Rasterizer und wäre langsamer, nicht
schneller** — die Engine ist schwerer, und ohne `SharedArrayBuffer` (§ 5.2)
zusätzlich einfädig. Man würde 48.000 Zeilen neu schreiben und danach
schlechter dastehen.

Die Prüfung kostet eine Konsole und eine Minute:

```js
const gl = document.createElement("canvas").getContext("webgl2");
const dbg = gl.getExtension("WEBGL_debug_renderer_info");
console.log(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
```

Steht dort `llvmpipe`, `SwiftShader` oder `ANGLE (Software)`, ist die Frage
beantwortet und die Umstellung hat ihren Anlass verloren. Steht dort eine
echte GPU, ist es ein Terra-Problem — und *dann* lohnt der Vergleich, aber
auch dann zuerst über Profiling, nicht über einen Engine-Wechsel.

**Dieser Punkt ist die wichtigste Einzelaussage des ganzen Berichts.**

---

## 9. Empfehlung

**Nicht umstellen.** Nicht, weil Godot das schlechtere Werkzeug wäre — für ein
Spiel mit Physik, Navigation, Animation und Desktop-Export ist es das bessere
—, sondern weil Terra keines dieser Probleme hat und die Umstellung genau die
Eigenschaften opfert, die es in diesem Repo wertvoll machen: offline,
buildfrei, in Sekunden testbar, im CSP-Rahmen ohne Ausnahme.

Drei Schritte, in dieser Reihenfolge:

### Schritt 1 — Den Anlass klären (Aufwand: eine Stunde)

`WEBGL_debug_renderer_info` auslesen (§ 8). Ergebnis in `terra/README.md`
nachtragen und den Punkt aus „Offener Stand" streichen. Danach ist bekannt,
ob es überhaupt ein Problem gibt.

### Schritt 2 — Falls Godot gewollt ist: als *zweiter* Renderer spiken

Nicht als Ersatz. Der Zuschnitt ergibt sich aus § 3 von selbst: Format v5 und
`postMessage`-Vertrag bleiben die Schnittstelle, ein Godot-Frame tritt neben
den Three-Frame.

Abbruchkriterien für einen zeitlich begrenzten Spike (1–2 Wochen):

| Frage | Messbar an |
|---|---|
| Lädt der Web-Export unter der **Produktions**-CSP? | Build mit `NODE_ENV=production`, nicht Dev |
| Reicht der einfädige Export? | fps gegen Terra auf **derselben** Maschine |
| Bleiben YouTube und Turnstile heil? | nur relevant, falls COEP nötig wird |
| Wie groß ist der Erstladen? | Bytes über den Tunnel, nicht im LAN |
| Wie sieht die CI aus? | läuft `pnpm test:terra`-Äquivalent im GitHub-Runner? |
| Trägt der Look? | Terrain + ein Biom + ein Objekt-Pool im Ghibli-Aufbau |

Scope des Spikes: ein v5-Kartenbaum wird gelesen und gerendert. Kein Editor,
keine Werkzeuge, keine Persistenz — die ist ohnehin schon fertig und
engine-unabhängig. Wenn dieser Spike nicht in zwei Wochen steht, ist die
Vollmigration mit Sicherheit kein Quartalsvorhaben.

Eine Vorbedingung, die man erwarten würde, entfällt: `TerraKarte` ist im
Backup erfasst (§ 6, nachgeprüft). Die Karten hängen nicht am rohen
Dateisnapshot.

### Schritt 3 — MCP getrennt entscheiden

Ein Godot-MCP-Server ist ein Entwicklungswerkzeug in `tools/` und hat mit der
Renderer-Frage nichts zu tun (§ 7). Er wird erst relevant, wenn Schritt 2
positiv ausgeht — und selbst dann nicht für das Produkt, sondern für das
Bauen.

---

## 10. Was sonst noch auffiel (unabhängig von Godot)

Zwei Kleinigkeiten, die bei der Bestandsaufnahme sichtbar wurden und für sich
stehen:

1. **`terra/README.md:3-5` ist veraltet** — behauptet CDN-Bezug von jsDelivr,
   tatsächlich ist Three seit dem 27.07.2026 vendored (§ 2.1). Für ein
   selbstgehostetes System ist die Aussage „hängt am CDN" das falsche Signal.
2. **Die 3–4-fps-Frage steht seit der Einzeldatei-Zeit offen** und blockiert
   laut README ausdrücklich weitere GPU-Arbeit. Sie ist geführt als **Punkt
   C10** in `terra-bearbeitungsplan.md:25` (seit Runde C, 26.07.2026) und dort
   in Zeile 126 ausdrücklich zur Vorbedingung für H1 erklärt: „auf einem
   Software-Rasterizer bringt Kachelung wenig, LOD dagegen viel". Sie blockiert
   damit bereits geplante Terra-Arbeit — unabhängig von jeder Godot-Frage — und
   ist in einer Stunde zu beantworten.

---

## Anhang: Belegstellen

| Aussage | Fundstelle |
|---|---|
| Umfang `terra/src` | 69 Dateien, `wc -l` → 47.884 |
| Three vendored, unverändert | `terra/vendor/HERKUNFT.md`, `terra/index.html:27-34` |
| Zwei Zielordner, eine Quelle | `scripts/copy-terra.mjs` (Kopfkommentar) |
| Frame ist reiner Renderer | `terra/src/editor/bruecke.js:4-11` |
| Origin **und** Source geprüft | `terra/src/editor/bruecke.js:30-35` |
| CSP-Ausnahmen für Terra | `packages/auth/src/security-headers.ts:63-67,80-83,149-152` |
| `script-src` ohne WASM-Freigabe | `packages/auth/src/security-headers.ts:50-53` |
| COOP gesetzt, COEP fehlt | `packages/auth/src/security-headers.ts:154-155` |
| YouTube / Turnstile im Frame-Src | `packages/auth/src/security-headers.ts:55,60,68-73` |
| Format v5, optimistische Sperre | `packages/database/prisma/schema.prisma:2710-2721` |
| Spieler-Entwurfs-Workflow | `packages/database/prisma/schema.prisma:2722-2740` |
| KI-Weg mit Doppelvalidierung | `packages/ai-brain/src/proposal-validators/terra-world-draft.ts`, `terra/src/editor/bruecke.js` (Vertrag `welt-vorgabe`) |
| Lokales Modell fest verdrahtet | `apps/studio/src/components/terra/brain-lauf.ts:19-22` |
| Tests ohne Abhängigkeiten | `terra/test/README.md:27-28` |
| Three-Stub erzeugt echte Vertexdaten | `terra/test/hilfen/three-stub.mjs:1-25` |
| Tests in drei CI-Skripten | `package.json:23,24,32,58` |
| MCP: HTTP-Clients, kein DB-Zugriff | `packages/mcp/src/servers.ts:1-9`, `packages/mcp/package.json` |
| Backup listet 22 Modelle namentlich | `docs/engineering/terra-runde-j-atlas-abbau.md` (Vorabbefund 1) |
| `TerraKarte` **ist** gesichert | `packages/backup/src/collect.ts:566`, `types.ts:259-265,551`, `restore.ts:654`, `backup.test.ts:293,371` |
| C10 seit Runde C offen, gatet H1 | `docs/engineering/terra-bearbeitungsplan.md:25,126` |
| Atlas-Abbau durchgeführt | Migration `20260727150000_drop_atlas3d` |
| Offene Performance-Frage | `terra/README.md:120-124` |
| `terra/` außerhalb des Größen-Wächters | `scripts/file-size-budget-check.mjs:32` (`SCAN_DIRS`) |
