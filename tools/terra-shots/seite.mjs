#!/usr/bin/env node
/**
 * `node tools/terra-shots/seite.mjs` — baut die Fortschrittsseite.
 *
 * Liest den Laufzustand (.terra-shots/fortschritt.json) sowie die Aufnahmen aus
 * Grundstand und aktuellem Stand und schreibt EINE eigenstaendige HTML-Datei:
 * je Aufnahme das Vorherbild neben dem Jetztbild, daneben das Urteil des
 * Kritikers und der Ausgang des Blindvergleichs.
 *
 * Die Bilder werden im Browser auf Anzeigebreite verkleinert und als JPEG
 * eingebettet — die Seite muss ohne Netz funktionieren (Artifact-CSP).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const hier = path.dirname(fileURLToPath(import.meta.url));
const repoWurzel = path.resolve(hier, "..", "..");
const require = createRequire(import.meta.url);

function ladePlaywright() {
  for (const k of [
    () => require("playwright"),
    () => require("@playwright/test"),
    () => require(path.join(repoWurzel, "node_modules", "playwright")),
    () => require("C:/git/UWE/node_modules/@playwright/test")
  ]) { try { return k(); } catch { /* weiter */ } }
  throw new Error("Playwright nicht gefunden.");
}

function args(argv) {
  const a = {
    zustand: path.join(repoWurzel, ".terra-shots", "fortschritt.json"),
    vorher: path.join(repoWurzel, ".terra-shots", "baseline"),
    jetzt: path.join(repoWurzel, ".terra-shots", "aktuell"),
    out: path.join(repoWurzel, ".terra-shots", "fortschritt.html"),
    breite: 880
  };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--zustand" && v) { a.zustand = path.resolve(v); i += 1; }
    else if (k === "--vorher" && v) { a.vorher = path.resolve(v); i += 1; }
    else if (k === "--jetzt" && v) { a.jetzt = path.resolve(v); i += 1; }
    else if (k === "--out" && v) { a.out = path.resolve(v); i += 1; }
    else if (k === "--breite" && v) { a.breite = Number(v); i += 1; }
  }
  return a;
}

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

async function verkleinern(seite, datei, breite) {
  if (!datei || !fs.existsSync(datei)) return null;
  const roh = `data:image/png;base64,${fs.readFileSync(datei).toString("base64")}`;
  return seite.evaluate(async ([quelle, zielBreite]) => {
    const bild = new Image();
    await new Promise((ok, weg) => { bild.onload = ok; bild.onerror = weg; bild.src = quelle; });
    const w = Math.min(zielBreite, bild.naturalWidth);
    const h = Math.round(bild.naturalHeight * (w / bild.naturalWidth));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(bild, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.74);
  }, [roh, breite]);
}

function urteilChip(u) {
  if (!u) return `<span class="chip chip--wartet">noch kein Urteil</span>`;
  const klasse = u.aaa ? "chip--gut" : "chip--schlecht";
  const note = Number.isFinite(u.note) ? ` · ${u.note.toFixed(1)}/10` : "";
  return `<span class="chip ${klasse}">${u.aaa ? "AAA bestanden" : "durchgefallen"}${note}</span>`;
}

function duellChip(d) {
  if (!d) return "";
  const gewonnen = d.gewinner === "terra";
  return `<span class="chip ${gewonnen ? "chip--gut" : "chip--schlecht"}">Blindvergleich: ${
    gewonnen ? "terra gewinnt" : "Referenz gewinnt"}</span>`;
}

async function main() {
  const a = args(process.argv.slice(2));
  const zustand = fs.existsSync(a.zustand)
    ? JSON.parse(fs.readFileSync(a.zustand, "utf8"))
    : { runde: 0, shots: [] };

  const { chromium } = ladePlaywright();
  const browser = await chromium.launch();
  const seite = await browser.newPage();
  await seite.setContent("<!doctype html><html><body></body></html>");

  const karten = [];
  for (const s of zustand.shots || []) {
    const vorher = await verkleinern(seite, path.join(a.vorher, `${s.id}.png`), a.breite);
    const jetzt = await verkleinern(seite, path.join(a.jetzt, `${s.id}.png`), a.breite);
    karten.push({ ...s, vorherBild: vorher, jetztBild: jetzt });
  }
  await browser.close();

  const fertig = karten.filter((k) => k.urteil && k.urteil.aaa).length;
  const gesamt = karten.length || 1;
  const anteil = Math.round((fertig / gesamt) * 100);

  const html = `<title>terra · Weg zur AAA-Abnahme</title>
<style>
:root{
  --grund:#F1F3F0; --karte:#FFFFFF; --rand:#D6DBD5;
  --text:#182028; --leise:#5C6A6B; --sehrleise:#8A9694;
  --akzent:#1F6F68; --gut:#2F6B45; --schlecht:#A83E28; --laeuft:#96701C;
  --schiene:rgba(31,111,104,.14);
}
@media (prefers-color-scheme:dark){
  :root{
    --grund:#10171A; --karte:#171F23; --rand:#28343A;
    --text:#E6ECEA; --leise:#9DAEAC; --sehrleise:#6C7E7D;
    --akzent:#5FBFB2; --gut:#6BBE84; --schlecht:#E08163; --laeuft:#D4A94A;
    --schiene:rgba(95,191,178,.16);
  }
}
:root[data-theme="dark"]{
  --grund:#10171A; --karte:#171F23; --rand:#28343A;
  --text:#E6ECEA; --leise:#9DAEAC; --sehrleise:#6C7E7D;
  --akzent:#5FBFB2; --gut:#6BBE84; --schlecht:#E08163; --laeuft:#D4A94A;
  --schiene:rgba(95,191,178,.16);
}
:root[data-theme="light"]{
  --grund:#F1F3F0; --karte:#FFFFFF; --rand:#D6DBD5;
  --text:#182028; --leise:#5C6A6B; --sehrleise:#8A9694;
  --akzent:#1F6F68; --gut:#2F6B45; --schlecht:#A83E28; --laeuft:#96701C;
  --schiene:rgba(31,111,104,.14);
}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--text);
  font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;
  padding:clamp(20px,4vw,52px)}
.huelle{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:30px}
h1{font-family:ui-serif,"Iowan Old Style","Palatino Linotype",Georgia,serif;
  font-size:clamp(30px,4.4vw,46px);line-height:1.08;margin:0;font-weight:600;
  letter-spacing:-.015em;text-wrap:balance}
.vorspann{color:var(--leise);max-width:62ch;margin:0}
.kopf{display:flex;flex-direction:column;gap:14px;
  border-bottom:1px solid var(--rand);padding-bottom:26px}
.zahlen{display:flex;flex-wrap:wrap;gap:26px 40px;margin-top:6px}
.zahl b{display:block;font-size:27px;font-variant-numeric:tabular-nums;
  font-weight:600;letter-spacing:-.02em}
.zahl span{font-size:11px;text-transform:uppercase;letter-spacing:.14em;
  color:var(--sehrleise)}
.balken{height:5px;background:var(--schiene);border-radius:3px;overflow:hidden}
.balken i{display:block;height:100%;background:var(--akzent);border-radius:3px}
.karte{background:var(--karte);border:1px solid var(--rand);border-radius:5px;
  overflow:hidden;display:flex;flex-direction:column}
.karte--gut{border-left:3px solid var(--gut)}
.karte--schlecht{border-left:3px solid var(--schlecht)}
.karte--wartet{border-left:3px solid var(--sehrleise)}
.kartenkopf{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:baseline;
  padding:17px 21px;border-bottom:1px solid var(--rand)}
.kartenkopf h2{font-size:18px;margin:0;font-weight:600;letter-spacing:-.01em}
.bereich{font-size:11px;text-transform:uppercase;letter-spacing:.14em;
  color:var(--akzent);font-weight:600}
.frage{width:100%;color:var(--leise);font-size:14px;margin:0}
.bilder{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rand)}
@media (max-width:760px){.bilder{grid-template-columns:1fr}}
figure{margin:0;background:var(--karte);display:flex;flex-direction:column}
figure img{width:100%;height:auto;display:block}
figcaption{font-size:11px;text-transform:uppercase;letter-spacing:.14em;
  color:var(--sehrleise);padding:9px 14px;order:-1;
  border-bottom:1px solid var(--rand)}
.leer{aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;
  color:var(--sehrleise);font-size:13px}
.urteil{padding:17px 21px;display:flex;flex-direction:column;gap:11px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font-size:12px;padding:3px 10px;border-radius:11px;font-weight:600;
  border:1px solid currentColor}
.chip--gut{color:var(--gut)}
.chip--schlecht{color:var(--schlecht)}
.chip--wartet{color:var(--sehrleise)}
.chip--runde{color:var(--leise);font-weight:500}
.zitat{margin:0;color:var(--text);font-size:15px;
  border-left:2px solid var(--schiene);padding-left:13px}
.maengel{margin:0;padding-left:19px;color:var(--leise);font-size:14px;
  display:flex;flex-direction:column;gap:4px}
.messwerte{display:flex;flex-wrap:wrap;gap:5px 20px;font-size:12.5px;
  color:var(--sehrleise);font-family:ui-monospace,"Cascadia Code",Consolas,monospace;
  font-variant-numeric:tabular-nums}
footer{color:var(--sehrleise);font-size:13px;border-top:1px solid var(--rand);
  padding-top:20px;display:flex;flex-direction:column;gap:5px}
</style>
<div class="huelle">
<header class="kopf">
  <h1>terra · Weg zur AAA-Abnahme</h1>
  <p class="vorspann">Jede Aufnahme im Grundstand neben dem aktuellen Stand, dazu das
  Urteil eines Kritikers, der die Aufnahme gegen echte Standbilder aus
  Anno&nbsp;117 und der offenen Studio-Ghibli-Galerie haelt. Der Blindvergleich
  legt beide Bilder unbeschriftet nebeneinander — der Kritiker weiss dabei nicht,
  welche Seite terra ist.</p>
  <div class="balken"><i style="width:${anteil}%"></i></div>
  <div class="zahlen">
    <div class="zahl"><b>${fertig}&thinsp;/&thinsp;${karten.length}</b><span>Aufnahmen bestanden</span></div>
    <div class="zahl"><b>${zustand.runde || 0}</b><span>Runde</span></div>
    <div class="zahl"><b>${esc(zustand.stand || "—")}</b><span>Stand</span></div>
  </div>
</header>
${karten.map((k) => {
  const zustandKlasse = !k.urteil ? "wartet" : (k.urteil.aaa ? "gut" : "schlecht");
  return `<article class="karte karte--${zustandKlasse}">
  <div class="kartenkopf">
    <span class="bereich">${esc(k.bereich || "")}</span>
    <h2>${esc(k.titel || k.id)}</h2>
    <p class="frage">${esc(k.frage || "")}</p>
  </div>
  <div class="bilder">
    <figure><figcaption>Grundstand</figcaption>${
      k.vorherBild ? `<img src="${k.vorherBild}" alt="Grundstand ${esc(k.id)}">`
        : `<div class="leer">keine Aufnahme</div>`}</figure>
    <figure><figcaption>aktuell${k.runde ? ` · Runde ${k.runde}` : ""}</figcaption>${
      k.jetztBild ? `<img src="${k.jetztBild}" alt="aktueller Stand ${esc(k.id)}">`
        : `<div class="leer">noch nicht neu aufgenommen</div>`}</figure>
  </div>
  <div class="urteil">
    <div class="chips">
      ${urteilChip(k.urteil)}
      ${duellChip(k.duell)}
      ${k.runde ? `<span class="chip chip--runde">Runde ${k.runde}</span>` : ""}
    </div>
    ${k.urteil && k.urteil.kritik ? `<p class="zitat">${esc(k.urteil.kritik)}</p>` : ""}
    ${k.urteil && k.urteil.maengel && k.urteil.maengel.length
      ? `<ul class="maengel">${k.urteil.maengel.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
    ${k.duell && k.duell.begruendung ? `<p class="zitat">${esc(k.duell.begruendung)}</p>` : ""}
    ${k.mess ? `<div class="messwerte">${
      [k.mess.calls != null ? `${k.mess.calls} Zeichenaufrufe` : null,
       k.mess.triangles != null ? `${k.mess.triangles.toLocaleString("de-DE")} Dreiecke` : null,
       k.mess.bildzeitMs != null ? `${k.mess.bildzeitMs} ms/Bild` : null]
        .filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
  </div>
</article>`;
}).join("\n")}
<footer>
  <span>Aufnahmen: kopfloses Chromium auf echter GPU (${esc(zustand.gpu || "unbekannt")}), 1600&times;900, virtuelle Uhr fuer bildgenaue Wiederholbarkeit.</span>
  <span>Referenzen liegen nur lokal und dienen dem Abgleich; die Seite zeigt ausschliesslich terra-Aufnahmen.</span>
</footer>
</div>`;

  fs.mkdirSync(path.dirname(a.out), { recursive: true });
  fs.writeFileSync(a.out, html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`Seite: ${a.out} (${kb} kB, ${karten.length} Aufnahmen, ${fertig} bestanden)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
