/* ==========================================================================
   I4 — Kartenbeschriftung (ui/beschriftung.js)

   Sechs Zusagen, die das Modul schriftlich gibt:

   1  Die Zielprüfung hält dicht. Eine geteilte Kartendatei darf keinen
      Klick-Angriff mitbringen — das ist die Prüfung, die wirklich zählt, und
      sie ist deshalb die längste.
   2  Die Klassentabelle ist vollständig. Eine Klasse ohne Schriftgrad oder
      ohne Maßstabsfenster fällt erst im Betrieb auf, und dann als undefined
      mitten in einem CSS-Wert.
   3  Die Kollisionsauflösung ist reihenfolgeunabhängig und bei Gleichstand
      entscheidet ein benanntes Kriterium.
   4  Sie flackert nicht. Gemessen wird die Zahl der Sichtbarkeitswechsel bei
      einer zitternden Kamera, gehalten gegen MAX_WECHSEL.
   5  Die Glyphen auf einer Kurve stehen in der richtigen Reihenfolge, in
      gleichmäßigem Abstand, ohne NaN und ohne Kopfstand.
   6  Alles ist deterministisch — zweimal aufgebaut, Zeichen für Zeichen gleich.

   Das Modul braucht weder Browser noch echtes Canvas: die rechnenden Teile
   sind DOM-frei, der Zeichenweg nimmt den Kontext als Parameter. Hier steht
   dafür ein mitschreibender Ersatz (protokollKontext), der jeden Aufruf in
   eine Liste legt.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const B = await ladeTerra('ui/beschriftung.js');

/** Schranke für Ebene 4. Ein einziger Wechsel ist erlaubt (der gewollte). */
const MAX_WECHSEL = 2;


/* ==========================================================================
   1 — zielPruefen hält dicht
   ========================================================================== */

/* Jede Zeile ist ein Angriff oder eine Fehlform, die NICHT durchkommen darf.
   Zusammengetragen aus den Standardlisten für Schema-Umgehungen: andere
   Schemata, Groß-/Kleinschreibung, eingestreute Steuerzeichen, führender
   Leerraum, URL-Kodierung, protokollrelative Form. */
const ANGRIFFE = [
  ['javascript:alert(1)', 'nacktes javascript'],
  ['JaVaScRiPt:alert(1)', 'gemischte Schreibweise'],
  ['JAVASCRIPT:alert(1)', 'Versalien'],
  ['java\u0000script:alert(1)', 'Nullbyte im Schema'],
  ['java\tscript:alert(1)', 'Tabulator im Schema'],
  ['java\nscript:alert(1)', 'Zeilenumbruch im Schema'],
  ['java\rscript:alert(1)', 'Wagenrücklauf im Schema'],
  ['java\u200bscript:alert(1)', 'Nullbreiten-Leerzeichen im Schema'],
  ['java\ufeffscript:alert(1)', 'BOM im Schema'],
  ['  javascript:alert(1)', 'führende Leerzeichen'],
  ['\u0009javascript:alert(1)', 'führender Tabulator'],
  ['\u00a0javascript:alert(1)', 'führendes geschütztes Leerzeichen'],
  ['\u202ejavascript:alert(1)', 'führende Schreibrichtungsmarke'],
  ['javascript:alert(1)  ', 'nachlaufende Leerzeichen'],
  ['%6a%61vascript:alert(1)', 'URL-kodiertes Schema'],
  ['javascript%3Aalert(1)', 'URL-kodierter Doppelpunkt'],
  ['&#106;avascript:alert(1)', 'HTML-Entität im Schema'],
  ['data:text/html;base64,PHNjcmlwdD4=', 'data-URI'],
  ['data:text/html,<script>alert(1)</script>', 'data-URI im Klartext'],
  ['vbscript:msgbox(1)', 'vbscript'],
  ['file:///C:/Windows/System32', 'lokale Datei'],
  ['blob:https://example.com/abc', 'blob mit http im Rumpf'],
  ['about:blank', 'about'],
  ['chrome://settings', 'browsereigenes Schema'],
  ['//example.com/pfad', 'protokollrelativ'],
  ['\\\\example.com\\freigabe', 'UNC-Pfad'],
  ['/etc/passwd', 'absoluter Pfad'],
  ['../../etc/passwd', 'relativer Pfad'],
  ['http:/example.com', 'nur ein Schrägstrich'],
  ['https:example.com', 'gar kein Schrägstrich'],
  ['http:///example.com', 'drei Schrägstriche, kein Rechnername'],
  ['https://', 'Schema ohne alles'],
  ['https://user:geheim@example.com/', 'Zugangsdaten in der Adresse'],
  ['https://uwe@boese.example/', 'Benutzername als Tarnung'],
  ['ht\u0000tps://example.com', 'Nullbyte im erlaubten Schema'],
  ['HTTP\u200b://example.com', 'Nullbreite im erlaubten Schema'],
  ['https://example.com/' + 'a'.repeat(3000), 'Adresse jenseits der Längengrenze']
];

test('Ebene I4/1 — zielPruefen weist jede Angriffsform ab (art: extern)', () => {
  const durch = [];
  for (const [ref, was] of ANGRIFFE) {
    const r = B.zielPruefen({ art: 'extern', ref });
    if (r.ok) durch.push(was + ' -> ' + JSON.stringify(ref));
  }
  assert.deepEqual(durch, [], 'diese Formen kamen durch');
});

test('Ebene I4/1 — auch als wiki-Referenz kommt keine Angriffsform durch', () => {
  const durch = [];
  for (const [ref, was] of ANGRIFFE) {
    const r = B.zielPruefen({ art: 'wiki', ref });
    if (r.ok) durch.push(was + ' -> ' + JSON.stringify(ref));
  }
  assert.deepEqual(durch, []);
});

test('Ebene I4/1 — gültige http/https-Adressen kommen durch', () => {
  const gut = [
    'http://example.com',
    'https://example.com',
    'https://example.com/',
    'https://uweanddragons.org/wiki/hafen-von-ost',
    'HTTPS://EXAMPLE.COM/Pfad?x=1#abschnitt',
    'https://example.com:8443/pfad',
    'https://example.com/a%20b',
    'https://xn--flgel-5qa.example/seite'
  ];
  for (const ref of gut) {
    const r = B.zielPruefen({ art: 'extern', ref });
    assert.equal(r.ok, true, ref + ' wurde abgelehnt: ' + r.grund);
    assert.equal(r.ziel.ref, ref, 'die Adresse wird unverändert durchgereicht');
    assert.equal(r.ziel.art, 'extern');
  }
});

test('Ebene I4/1 — gültige Wiki-Kennungen kommen durch, Adressformen nicht', () => {
  for (const ref of ['hafen-von-ost', 'Hafen/Von/Ost', 'arbor_wurzel', 'Gruenes-Tal',
    'Grünes-Tal', 'ort42', 'Ostklamm']) {
    const r = B.zielPruefen({ art: 'wiki', ref });
    assert.equal(r.ok, true, ref + ' wurde abgelehnt: ' + r.grund);
    assert.equal(r.ziel.ref, ref);
  }
  // Eine Wiki-Kennung ist eine Kennung, keine Adresse: alles, was nach Adresse
  // riecht, faellt weg — sonst wuerde aus der Seitenreferenz spaeter eine URL.
  for (const ref of ['hafen von ost', 'hafen.von.ost', 'hafen%2Fost', 'hafen:ost',
    '/hafen', 'hafen/', '-hafen', 'hafen--ost', '', 'a'.repeat(201)]) {
    assert.equal(B.zielPruefen({ art: 'wiki', ref }).ok, false,
      JSON.stringify(ref) + ' haette abgelehnt werden muessen');
  }
});

test('Ebene I4/1 — Zielart und Form des Feldes werden geprüft', () => {
  for (const ziel of [
    { art: 'skript', ref: 'https://example.com' },
    { art: 'WIKI', ref: 'hafen' },
    { art: 42, ref: 'https://example.com' },
    { art: 'extern', ref: 42 },
    { art: 'extern', ref: { toString: () => 'https://example.com' } },
    { art: 'extern' },
    ['extern', 'https://example.com'],
    'https://example.com',
    42
  ]) {
    assert.equal(B.zielPruefen(ziel).ok, false,
      JSON.stringify(ziel) + ' haette abgelehnt werden muessen');
  }
  // Fehlendes Ziel ist kein Fehler — jede Karte vor dieser Runde hat keines.
  assert.equal(B.zielPruefen(undefined).ok, true);
  assert.equal(B.zielPruefen(null).ok, true);
  assert.equal(B.zielPruefen({}).ziel.art, 'keins');
});

test('Ebene I4/1 — art "keins" traegt keine Referenz mit sich', () => {
  const r = B.zielPruefen({ art: 'keins', ref: 'javascript:alert(1)' });
  assert.equal(r.ok, true, 'kein Ziel ist kein Formatfehler');
  assert.equal(r.ziel.ref, '', 'die Referenz wird geleert, nicht mitgeschleppt');
});

test('Ebene I4/1 — zielUrl liefert nur geprüfte Adressen', () => {
  assert.equal(B.zielUrl({ art: 'extern', ref: 'https://example.com/a' }), 'https://example.com/a');
  assert.equal(B.zielUrl({ art: 'extern', ref: 'javascript:alert(1)' }), null);
  assert.equal(B.zielUrl({ art: 'keins', ref: '' }), null);
  // Ohne Wiki-Basis bleibt ein wiki-Ziel stumm — solange terra eigenstaendig
  // laeuft, gibt es die Basis nicht.
  assert.equal(B.zielUrl({ art: 'wiki', ref: 'hafen-von-ost' }), null);
  assert.equal(B.zielUrl({ art: 'wiki', ref: 'hafen-von-ost' },
    { wikiBasis: 'https://uweanddragons.org/wiki' }), 'https://uweanddragons.org/wiki/hafen-von-ost');
  assert.equal(B.zielUrl({ art: 'wiki', ref: 'hafen-von-ost' },
    { wikiBasis: 'https://uweanddragons.org/wiki/' }), 'https://uweanddragons.org/wiki/hafen-von-ost');
  // Eine falsch gesetzte Basis darf die Erlaubnisliste nicht aushebeln.
  assert.equal(B.zielUrl({ art: 'wiki', ref: 'hafen' }, { wikiBasis: 'javascript:' }), null);
  assert.equal(B.zielUrl({ art: 'wiki', ref: 'hafen' }, { wikiBasis: '//example.com' }), null);
});

test('Ebene I4/1 — zielOeffnen oeffnet nur Erlaubtes und nie in der Aufnahme', () => {
  const rufe = [];
  const fenster = { open: (...a) => rufe.push(a) };

  assert.equal(B.zielOeffnen({ art: 'extern', ref: 'javascript:alert(1)' }, { fenster }), false);
  assert.equal(rufe.length, 0, 'ein abgelehntes Ziel darf window.open nicht erreichen');

  assert.equal(B.zielOeffnen({ art: 'extern', ref: 'https://example.com/' }, { fenster }), true);
  assert.deepEqual(rufe[0], ['https://example.com/', '_blank', 'noopener,noreferrer'],
    'neues Fenster, ohne opener und ohne Verweis');

  // Im Aufnahme-Modus und beim PNG-Export ist die Beschriftung Bild, nicht
  // Bedienelement.
  assert.equal(B.zielOeffnen({ art: 'extern', ref: 'https://example.com/' },
    { fenster, aufnahme: true }), false);
  assert.equal(rufe.length, 1);
});


/* ==========================================================================
   2 — Die Klassentabelle ist vollständig
   ========================================================================== */

const PFLICHT_ZAHL = ['grad', 'gewicht', 'sperrung', 'saumBreite', 'prioritaet',
  'massstabVon', 'massstabBis'];
const PFLICHT_TEXT = ['id', 'label', 'stapel', 'farbe', 'saum'];
const PFLICHT_JANEIN = ['kursiv', 'versalien', 'signatur', 'folgtPfad'];

test('Ebene I4/2 — alle sechs Klassen sind da, und nur die sechs', () => {
  assert.deepEqual(B.KLASSEN_IDS.slice().sort(),
    ['arbor', 'gebirge', 'gefahr', 'gewaesser', 'ort', 'region']);
  assert.deepEqual(Object.keys(B.KLASSEN).slice().sort(), B.KLASSEN_IDS.slice().sort(),
    'KLASSEN_IDS und die Tabelle duerfen nicht auseinanderlaufen');
});

test('Ebene I4/2 — jede Klasse hat Schriftgrad, Sperrung, Farbe, Rang, Maßstabsfenster', () => {
  const fehlt = [];
  for (const id of B.KLASSEN_IDS) {
    const K = B.KLASSEN[id];
    assert.equal(K.id, id, 'die id im Eintrag muss dem Schluessel entsprechen');
    for (const f of PFLICHT_ZAHL) {
      if (typeof K[f] !== 'number' || Number.isNaN(K[f])) fehlt.push(id + '.' + f);
    }
    for (const f of PFLICHT_TEXT) {
      if (typeof K[f] !== 'string' || !K[f]) fehlt.push(id + '.' + f);
    }
    for (const f of PFLICHT_JANEIN) {
      if (typeof K[f] !== 'boolean') fehlt.push(id + '.' + f);
    }
    if (K.massstabVon > K.massstabBis) fehlt.push(id + ': Fenster verkehrt herum');
    if (K.grad <= 0) fehlt.push(id + ': Schriftgrad <= 0');
    if (!/^#[0-9a-f]{6}$/i.test(K.farbe)) fehlt.push(id + '.farbe ist kein Farbwert');
    if (!/^#[0-9a-f]{6}$/i.test(K.saum)) fehlt.push(id + '.saum ist kein Farbwert');
  }
  assert.deepEqual(fehlt, []);
});

test('Ebene I4/2 — die Klassen unterscheiden sich typografisch wirklich', () => {
  // Wenn zwei Klassen in Grad, Sperrung, Versalien, Kursiv und Farbe
  // uebereinstimmen, ist eine davon ueberfluessig — dann traegt die Tabelle
  // ihre eigene Begruendung nicht mehr.
  const gesehen = new Map();
  for (const id of B.KLASSEN_IDS) {
    const K = B.KLASSEN[id];
    const merkmal = [K.grad, K.sperrung, K.versalien, K.kursiv, K.farbe, K.stapel].join('|');
    assert.equal(gesehen.has(merkmal), false,
      id + ' ist typografisch nicht von ' + gesehen.get(merkmal) + ' zu unterscheiden');
    gesehen.set(merkmal, id);
  }
  // Die Konvention selbst: Gewaesser kursiv, Region und Gebirge gesperrte
  // Versalien, Ort mit Punktsignatur, Gefahr im warmen Rot.
  assert.equal(B.KLASSEN.gewaesser.kursiv, true);
  assert.equal(B.KLASSEN.region.versalien, true);
  assert.ok(B.KLASSEN.region.sperrung >= 0.2);
  assert.ok(B.KLASSEN.gebirge.sperrung >= 0.2);
  assert.equal(B.KLASSEN.ort.signatur, true);
  assert.equal(B.KLASSEN.gefahr.farbe.toLowerCase(), '#c1523c');
  assert.ok(B.KLASSEN.arbor.sperrung > B.KLASSEN.region.sperrung,
    'Arbor traegt die weiteste Sperrung der Tabelle');
});

test('Ebene I4/2 — Rang aus Klasse und Groesse, geklammert', () => {
  assert.ok(B.prioritaetVon('region', 1) > B.prioritaetVon('ort', 1));
  assert.ok(B.prioritaetVon('ort', 2) > B.prioritaetVon('ort', 1));
  assert.ok(B.prioritaetVon('ort', 0.5) < B.prioritaetVon('ort', 1));
  // Eine hochgedrehte Ortsbeschriftung darf auch die kleinste Region nicht
  // verdraengen — die Groesse verschiebt den Rang, sie kehrt ihn nicht um.
  assert.ok(B.prioritaetVon('ort', 99) < B.prioritaetVon('region', 0.4));
  assert.ok(B.prioritaetVon('ort', 99) === B.prioritaetVon('ort', 3), 'Groesse ist geklammert');
  assert.equal(B.prioritaetVon('gibtsnicht', 1), B.prioritaetVon('ort', 1),
    'unbekannte Klassen fallen auf ort, wie mkMarker auf die Markerart');
  assert.equal(Number.isFinite(B.prioritaetVon('ort', NaN)), true);
});

test('Ebene I4/2 — das Maßstabsfenster wird ausgewertet', () => {
  // I1 gibt es noch nicht; bis dahin reicht der Aufrufer eine Konstante herein.
  assert.equal(B.imMassstab('ort', undefined), true, 'ohne Maßstab ist alles sichtbar');
  assert.equal(B.imMassstab('ort', 100), true);
  assert.equal(B.imMassstab('ort', 5000), false, 'Orte verschwinden im weiten Blick');
  assert.equal(B.imMassstab('region', 60), false, 'Regionen verschwinden im Nahbereich');
  assert.equal(B.imMassstab('region', 5000), true);
  assert.equal(B.imMassstab('arbor', 5), true);
  assert.equal(B.imMassstab('arbor', 100000), true, 'Arbor ist in jedem Maßstab da');
});


/* ==========================================================================
   3 — Kollisionsauflösung
   ========================================================================== */

function kasten(id, x, prio, extra) {
  return Object.assign({ id, schluessel: id, x, y: 100, w: 80, h: 20, prioritaet: prio }, extra || {});
}

/** Deterministische Umordnungen einer Liste — kein Zufall, nur Rotationen. */
function umordnungen(liste) {
  const out = [liste.slice(), liste.slice().reverse()];
  for (let k = 1; k < liste.length; k++) out.push(liste.slice(k).concat(liste.slice(0, k)));
  return out;
}

test('Ebene I4/3 — bei Überdeckung bleibt der höhere Rang', () => {
  const sichtbar = B.loeseKollisionen([kasten('schwach', 100, 40), kasten('stark', 130, 90)]);
  assert.deepEqual([...sichtbar], ['stark']);
});

test('Ebene I4/3 — das Ergebnis hängt nicht von der Eingabereihenfolge ab', () => {
  const liste = [
    kasten('a', 100, 90), kasten('b', 130, 45), kasten('c', 400, 45),
    kasten('d', 430, 65), kasten('e', 800, 45), kasten('f', 1200, 90)
  ];
  let erwartet = null;
  for (const variante of umordnungen(liste)) {
    const s = [...B.loeseKollisionen(variante)].sort();
    if (erwartet === null) erwartet = s;
    else assert.deepEqual(s, erwartet, 'andere Eingabereihenfolge, anderes Ergebnis');
  }
  assert.ok(erwartet.length > 0);
});

test('Ebene I4/3 — bei gleichem Rang entscheidet der Schlüssel, nicht der Zufall', () => {
  const liste = [kasten('zeta', 100, 50), kasten('alpha', 130, 50)];
  for (const variante of umordnungen(liste)) {
    assert.deepEqual([...B.loeseKollisionen(variante)], ['alpha'],
      'bei Gleichstand gewinnt die alphabetisch erste — immer dieselbe');
  }
  // Auch bei gleichem Schluessel bleibt die Ordnung total (dann ueber die id).
  const gleich = [
    { id: 'zwei', schluessel: 'gleich', x: 100, y: 100, w: 80, h: 20, prioritaet: 50 },
    { id: 'eins', schluessel: 'gleich', x: 130, y: 100, w: 80, h: 20, prioritaet: 50 }
  ];
  for (const variante of umordnungen(gleich)) {
    assert.deepEqual([...B.loeseKollisionen(variante)], ['eins']);
  }
});

test('Ebene I4/3 — freistehende Kästen bleiben alle sichtbar', () => {
  const liste = [kasten('a', 0, 40), kasten('b', 200, 40), kasten('c', 400, 40)];
  assert.deepEqual([...B.loeseKollisionen(liste)].sort(), ['a', 'b', 'c']);
});

test('Ebene I4/3 — unbrauchbare Kästen werden übergangen, nicht gezählt', () => {
  const liste = [kasten('gut', 0, 40),
    { id: 'nan', schluessel: 'nan', x: NaN, y: 0, w: 10, h: 10, prioritaet: 99 },
    null];
  assert.deepEqual([...B.loeseKollisionen(liste)], ['gut']);
});


/* ==========================================================================
   4 — Kein Flackern

   Aufbau: zwei Kästen gleicher Größe, der linke stark, der rechte schwach.
   Der Abstand zittert um genau die Schwelle, an der sie sich zu berühren
   aufhören (w = 80, also 80 px Mittenabstand). Ohne Hysterese wechselt der
   schwache Kasten bei jedem Schritt; mit Hysterese liegt zwischen Ein- und
   Ausblenden ein Band von 2·hysterese Pixeln, in dem nichts passiert.
   ========================================================================== */

function wechselZaehlen(abstaende, hysterese) {
  let vorher = new Set();
  let letzter = null, wechsel = 0;
  for (const dx of abstaende) {
    vorher = B.loeseKollisionen(
      [kasten('stark', 0, 90), kasten('schwach', dx, 45)],
      { vorher, hysterese });
    const jetzt = vorher.has('schwach');
    if (letzter !== null && jetzt !== letzter) wechsel++;
    letzter = jetzt;
  }
  return wechsel;
}

/* Zittern um 80 px — 40 Schritte, immer knapp unter und knapp über die
   Schwelle. Genau das, was eine ruhig gehaltene Maus mit der Kamera macht. */
const ZITTERN = [];
for (let i = 0; i < 40; i++) ZITTERN.push(i % 2 === 0 ? 76 : 84);

test('Ebene I4/4 — ohne Hysterese flackert es (die Gegenprobe)', () => {
  const w = wechselZaehlen(ZITTERN, 0);
  assert.ok(w > 20, 'die Gegenprobe muss flackern, sonst prueft der naechste Test nichts (war: ' + w + ')');
});

test('Ebene I4/4 — mit Hysterese bleibt es unter MAX_WECHSEL', () => {
  const w = wechselZaehlen(ZITTERN, B.HYSTERESE_PX);
  assert.ok(w <= MAX_WECHSEL,
    'Sichtbarkeitswechsel: ' + w + ', erlaubt sind hoechstens ' + MAX_WECHSEL);
});

test('Ebene I4/4 — eine echte Bewegung schaltet trotzdem', () => {
  // Die Hysterese darf nicht dazu fuehren, dass eine weggeschobene
  // Beschriftung nie wiederkommt.
  const fahrt = [];
  for (let dx = 0; dx <= 200; dx += 4) fahrt.push(dx);
  let vorher = new Set(), zuletzt = null;
  for (const dx of fahrt) {
    vorher = B.loeseKollisionen([kasten('stark', 0, 90), kasten('schwach', dx, 45)],
      { vorher, hysterese: B.HYSTERESE_PX });
    zuletzt = vorher.has('schwach');
  }
  assert.equal(zuletzt, true, 'bei 200 px Abstand muss die schwache wieder da sein');
});

test('Ebene I4/4 — die Drosselung ist benannt und liegt bei ein paar Mal je Sekunde', () => {
  assert.ok(B.TAKT_MS >= 100 && B.TAKT_MS <= 400,
    'nicht je Bild, aber auch nicht so traege, dass man es sieht: ' + B.TAKT_MS + ' ms');
});


/* ==========================================================================
   5 — Glyphen auf der Kurve
   ========================================================================== */

/** Kreisbogen als Polylinie: konstante Krümmung, exakt nachrechenbar. */
function bogen(mx, my, r, vonGrad, bisGrad, n) {
  const P = [];
  for (let i = 0; i <= n; i++) {
    const t = (vonGrad + (bisGrad - vonGrad) * (i / n)) * Math.PI / 180;
    P.push({ x: mx + r * Math.cos(t), y: my + r * Math.sin(t) });
  }
  return P;
}

const TEXT = 'Silberfluss';

test('Ebene I4/5 — Reihenfolge, Abstände, keine NaN, kein Kopfstand', () => {
  const r = B.glyphenAufKurve(TEXT, bogen(150, -120, 120, 130, 50, 40),
    { grad: 14, sperrung: 0.06, versatz: 6 });
  assert.equal(r.tauglich, true, r.grund);
  assert.equal(r.glyphen.length, TEXT.length);

  const sperr = 0.06 * 14;
  for (let i = 0; i < r.glyphen.length; i++) {
    const g = r.glyphen[i];
    assert.equal(g.zeichen, TEXT[i], 'Glyphe ' + i + ' steht an der falschen Stelle');
    assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y), 'NaN in der Position bei ' + i);
    assert.ok(Number.isFinite(g.winkel), 'NaN in der Drehung bei ' + i);
    assert.ok(Math.abs(g.winkel) <= Math.PI / 2 + 1e-9, 'Glyphe ' + i + ' steht auf dem Kopf');
    assert.ok(g.breite > 0);
    if (i === 0) continue;
    const v = r.glyphen[i - 1];
    const d = Math.hypot(g.x - v.x, g.y - v.y);
    const soll = (v.breite + g.breite) / 2 + sperr;
    assert.ok(d > soll * 0.7 && d < soll * 1.4,
      'Abstand ' + (i - 1) + '->' + i + ' ist ' + d.toFixed(2) + ', erwartet ~' + soll.toFixed(2));
  }
});

test('Ebene I4/5 — die Laufweite bleibt auf beiden Seiten der Kurve gleichmäßig', () => {
  // Das ist die Korrektur gegen "aussen zieht auseinander": derselbe Bogen,
  // einmal mit der Basislinie weit innen, einmal weit aussen. In beiden Faellen
  // muessen die Abstaende auf der BASISLINIE gleich bleiben.
  for (const versatz of [-25, -6, 6, 25]) {
    const r = B.glyphenAufKurve(TEXT, bogen(150, -120, 120, 130, 50, 60),
      { grad: 14, sperrung: 0.06, versatz });
    assert.equal(r.tauglich, true, 'versatz ' + versatz + ': ' + r.grund);
    const gaps = [];
    for (let i = 1; i < r.glyphen.length; i++) {
      const a = r.glyphen[i - 1], b = r.glyphen[i];
      gaps.push(Math.hypot(b.x - a.x, b.y - a.y) - (a.breite + b.breite) / 2);
    }
    const min = Math.min(...gaps), max = Math.max(...gaps);
    assert.ok(max - min < 14 * 0.35,
      'versatz ' + versatz + ': Laufweite schwankt um ' + (max - min).toFixed(2) + ' px');
  }
});

test('Ebene I4/5 — ein nach links laufender Pfad wird umgekehrt gelesen', () => {
  const r = B.glyphenAufKurve(TEXT, [{ x: 400, y: 0 }, { x: 0, y: 0 }], { grad: 14 });
  assert.equal(r.tauglich, true, r.grund);
  for (const g of r.glyphen) assert.ok(Math.abs(g.winkel) < 1e-9, 'kein Kopfstand auf gerader Bahn');
  for (let i = 1; i < r.glyphen.length; i++) {
    assert.ok(r.glyphen[i].x > r.glyphen[i - 1].x,
      'die Zeile muss nach rechts laufen, auch wenn der Pfad nach links zeigt');
  }
});

test('Ebene I4/5 — eine zu enge Biegung wird abgelehnt statt verbogen', () => {
  // Zwei Geraden mit einer Haarnadel von 6 px Radius dazwischen. Die Zeile
  // sitzt mittig, also genau in der Nadel.
  const P = [{ x: 0, y: 0 }, { x: 200, y: 0 }]
    .concat(bogen(200, 6, 6, -90, 90, 16))
    .concat([{ x: 0, y: 12 }]);
  const r = B.glyphenAufKurve('Ostklamm', P, { grad: 14 });
  assert.equal(r.tauglich, false);
  assert.equal(r.grund, 'Biegung zu eng');
  assert.deepEqual(r.glyphen, [], 'eine untaugliche Kette liefert keine halben Glyphen');
});

test('Ebene I4/5 — ein zu kurzer Pfad wird abgelehnt', () => {
  const r = B.glyphenAufKurve(TEXT, [{ x: 0, y: 0 }, { x: 10, y: 0 }], { grad: 14 });
  assert.equal(r.tauglich, false);
  assert.equal(r.grund, 'Pfad zu kurz');
  assert.ok(r.textLaenge > r.pfadLaenge);
});

test('Ebene I4/5 — kaputte Eingaben liefern eine Absage, keinen Absturz', () => {
  assert.equal(B.glyphenAufKurve('', [{ x: 0, y: 0 }, { x: 100, y: 0 }]).tauglich, false);
  assert.equal(B.glyphenAufKurve('Ort', []).tauglich, false);
  assert.equal(B.glyphenAufKurve('Ort', [{ x: 0, y: 0 }]).tauglich, false);
  assert.equal(B.glyphenAufKurve('Ort', [{ x: 0, y: 0 }, { x: 0, y: 0 }]).tauglich, false);
  assert.equal(B.glyphenAufKurve('Ort', [{ x: NaN, y: 0 }, { x: 100, y: 0 }]).tauglich, false);
  assert.equal(B.glyphenAufKurve('Ort', null).tauglich, false);
});

test('Ebene I4/5 — die gerade Kette hat dieselbe Form wie die gebogene', () => {
  const r = B.glyphenGerade(TEXT, { grad: 14, sperrung: 0.06, x: 10, y: 20 });
  assert.equal(r.glyphen.length, TEXT.length);
  for (let i = 0; i < r.glyphen.length; i++) {
    assert.equal(r.glyphen[i].zeichen, TEXT[i]);
    assert.equal(r.glyphen[i].winkel, 0);
    assert.equal(r.glyphen[i].y, 20);
    if (i) assert.ok(r.glyphen[i].x > r.glyphen[i - 1].x);
  }
});


/* ==========================================================================
   6 — Determinismus und Zeichenweg
   ========================================================================== */

/** Kontext, der jeden Aufruf mitschreibt. Ersetzt das Canvas, das es hier
 *  nicht gibt — und macht die Zeichenfolge selbst zum Prüfgegenstand. */
function protokollKontext() {
  const log = [];
  const ctx = {
    log,
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    translate: (x, y) => log.push('translate ' + x.toFixed(3) + ' ' + y.toFixed(3)),
    rotate: (w) => log.push('rotate ' + w.toFixed(5)),
    clearRect: (...a) => log.push('clearRect ' + a.join(',')),
    beginPath: () => log.push('beginPath'),
    arc: (x, y, r) => log.push('arc ' + x.toFixed(3) + ' ' + y.toFixed(3) + ' ' + r.toFixed(3)),
    fill: () => log.push('fill'),
    strokeText: (t, x, y) => log.push('strokeText ' + t + ' ' + x.toFixed(3) + ' ' + y.toFixed(3)),
    fillText: (t, x, y) => log.push('fillText ' + t + ' ' + x.toFixed(3) + ' ' + y.toFixed(3)),
    measureText: () => ({ width: 0 })          // wie das echte Canvas im Test: nichts
  };
  for (const f of ['font', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin',
    'lineCap', 'miterLimit', 'textAlign', 'textBaseline']) {
    let wert;
    Object.defineProperty(ctx, f, {
      get: () => wert,
      set: (v) => { wert = v; log.push(f + '=' + v); }
    });
  }
  return ctx;
}

test('Ebene I4/6 — zweimal gezeichnet ergibt Zeichen für Zeichen dasselbe', () => {
  for (const klasse of B.KLASSEN_IDS) {
    const a = protokollKontext(), b = protokollKontext();
    B.zeichneBeschriftung(a, 'Hafen von Ost', klasse, { groesse: 1.0 });
    B.zeichneBeschriftung(b, 'Hafen von Ost', klasse, { groesse: 1.0 });
    assert.deepEqual(a.log, b.log, klasse + ' zeichnet nicht reproduzierbar');
    assert.ok(a.log.length > 10, klasse + ' hat gar nicht gezeichnet');
  }
});

test('Ebene I4/6 — zweimal verteilt ergibt dieselbe Glyphenkette', () => {
  const P = bogen(150, -120, 120, 130, 50, 40);
  const opt = { grad: 14, sperrung: 0.06, versatz: 6 };
  assert.deepEqual(B.glyphenAufKurve(TEXT, P, opt), B.glyphenAufKurve(TEXT, P, opt));
  // Auch dieselbe Kurve aus einer zweiten, gleich gerechneten Punktliste.
  assert.deepEqual(B.glyphenAufKurve(TEXT, P, opt),
    B.glyphenAufKurve(TEXT, bogen(150, -120, 120, 130, 50, 40), opt));
});

test('Ebene I4/6 — der Saum liegt HINTER der Schrift, nicht darüber', () => {
  const ctx = protokollKontext();
  B.zeichneBeschriftung(ctx, 'Ost', 'ort', {});
  const stroke = ctx.log.findIndex(z => z.startsWith('strokeText O'));
  const fill = ctx.log.findIndex(z => z.startsWith('fillText O'));
  assert.ok(stroke >= 0 && fill >= 0, 'beides muss gezeichnet werden');
  assert.ok(stroke < fill, 'erst der Saum, dann die Fuellung');
  // Farben und Saumbreite kommen aus der Klassentabelle.
  assert.ok(ctx.log.includes('strokeStyle=' + B.KLASSEN.ort.saum));
  assert.ok(ctx.log.includes('fillStyle=' + B.KLASSEN.ort.farbe));
});

test('Ebene I4/6 — Versalienklassen werden versal gesetzt, Leerzeichen nicht gemalt', () => {
  const ctx = protokollKontext();
  B.zeichneBeschriftung(ctx, 'Hafen von Ost', 'region', {});
  const gemalt = ctx.log.filter(z => z.startsWith('fillText')).map(z => z.split(' ')[1]);
  assert.deepEqual(gemalt.join(''), 'HAFENVONOST',
    'Versalien nach Klassenregel, und fuer ein Leerzeichen wird nichts gemalt');
});

test('Ebene I4/6 — Maße sind für jede Klasse endlich und positiv', () => {
  for (const klasse of B.KLASSEN_IDS) {
    for (const groesse of [0.4, 1, 2.5]) {
      const m = B.messeBeschriftung('Hafen von Ost', klasse, { groesse });
      for (const f of ['breite', 'hoehe', 'grad', 'textBreite', 'grundlinie', 'textX']) {
        assert.ok(Number.isFinite(m[f]) && m[f] > 0, klasse + '/' + groesse + ': ' + f + ' = ' + m[f]);
      }
      assert.ok(m.breite > m.textBreite, 'der Saum braucht Rand');
      assert.equal(m.breiten.length, m.text.length);
    }
  }
  // Der CSS-Wert muss den Stapel wirklich tragen — sonst faellt die Karte
  // stumm auf die Standardschrift des Browsers zurueck.
  assert.ok(B.schriftAngabe('gewaesser', 1).startsWith('italic '));
  assert.ok(B.schriftAngabe('ort', 1).includes('Segoe UI'));
  assert.ok(B.schriftAngabe('region', 1).includes('Palatino'));
});

test('Ebene I4/6 — kein Math.random, kein Datum, keine Uhr im Ergebnis', () => {
  const quelle = fs.readFileSync(path.join(SRC, 'ui', 'beschriftung.js'), 'utf8');
  // Gesucht wird der AUFRUF, nicht das Wort — die Datei benennt beides in
  // ihren Kommentaren, und ein Kommentar hat noch nie gewuerfelt.
  assert.equal(/Math\.random\s*\(/.test(quelle), false, 'Math.random kommt in terra nicht vor');
  assert.equal(/Date\.now\s*\(|new\s+Date\s*\(|performance\.now\s*\(/.test(quelle), false,
    'die Zeit kommt als Parameter herein, nicht aus einer Uhr');
});


/* ==========================================================================
   7 — Bildraum: Maßstabsfenster und Kamerarücken
   ========================================================================== */

test('Ebene I4/7 — bildKaesten filtert nach Maßstab und blendet hinter der Kamera aus', () => {
  const eintraege = [
    { id: 'ort1', klasse: 'ort', groesse: 1, x: 0, y: 0, z: 0, breitePx: 60, hoehePx: 18 },
    { id: 'reg1', klasse: 'region', groesse: 1, x: 1, y: 0, z: 0, breitePx: 90, hoehePx: 22 }
  ];
  const sicht = (massstab, ndc) => ({
    projiziere: () => ndc, breite: 1600, hoehe: 900, massstab
  });
  const mitte = { x: 0, y: 0, z: 0.5 };

  // Nahbereich: der Ort ist da, die Region nicht.
  let k = B.bildKaesten(eintraege, sicht(100, mitte));
  assert.deepEqual(k.map(e => e.id), ['ort1']);
  assert.equal(k[0].x, 800);
  assert.equal(k[0].y, 450);
  assert.equal(k[0].prioritaet, B.prioritaetVon('ort', 1));

  // Weiter Blick: umgekehrt.
  k = B.bildKaesten(eintraege, sicht(3000, mitte));
  assert.deepEqual(k.map(e => e.id), ['reg1']);

  // Hinter der Kamera (z > 1) faellt alles weg — dieselbe Regel wie im
  // Marker-Overlay aus D1.
  assert.deepEqual(B.bildKaesten(eintraege, sicht(100, { x: 0, y: 0, z: 1.2 })), []);
  // Weit ausserhalb des Bildes ebenso.
  assert.deepEqual(B.bildKaesten(eintraege, sicht(100, { x: 2.0, y: 0, z: 0.5 })), []);
  // Knapp ausserhalb bleibt stehen (kein Aufblitzen am Rand).
  assert.equal(B.bildKaesten(eintraege, sicht(100, { x: 1.2, y: 0, z: 0.5 })).length, 1);
});

/* ==========================================================================
   8 — Die Szenenschicht (Rauchtest)

   Der Three-Ersatz kann keine echte Projektion (project() ist dort Formsache),
   deshalb kommt sie hier als Funktion herein — genau der Ausweg, fuer den
   `sicht.projiziere` vorgesehen ist. Geprueft wird der Lebenslauf: anlegen,
   abgleichen, umbenennen, entfernen, aufraeumen.
   ========================================================================== */

function fakeCanvas() {
  const ctx = protokollKontext();
  return { width: 0, height: 0, getContext: () => ctx };
}

test('Ebene I4/8 — die Schicht legt an, gleicht ab und raeumt auf', () => {
  const schicht = B.neueSchicht({ canvasFabrik: fakeCanvas });
  assert.equal(schicht.anzahl, 0);
  assert.equal(schicht.gruppe.name, 'beschriftungen');

  const quellen = [
    { id: 1, text: 'Hafen von Ost', klasse: 'ort', groesse: 1, x: 0, y: 2, z: 0, ziel: { art: 'keins' } },
    { id: 2, text: 'Silberfluss', klasse: 'gewaesser', groesse: 1, x: 40, y: 2, z: 0, ziel: null },
    { id: 3, text: '', klasse: 'ort', groesse: 1, x: 80, y: 2, z: 0 }   // ohne Text: keine Beschriftung
  ];
  assert.equal(schicht.abgleichen(quellen), 2);
  assert.equal(schicht.gruppe.children.length, 2);

  // Zweiter Abgleich mit gleichem Inhalt baut keine neue Textur.
  const vorher = schicht.gruppe.children.slice();
  schicht.abgleichen(quellen);
  assert.deepEqual(schicht.gruppe.children, vorher, 'unveraenderter Text = dieselbe Textur');

  // Umbenennen tauscht das Sprite, Entfernen raeumt es weg.
  quellen[0].text = 'Hafen von West';
  schicht.abgleichen(quellen);
  assert.equal(schicht.anzahl, 2);
  assert.equal(schicht.abgleichen([quellen[1]]), 1);
  assert.equal(schicht.gruppe.children.length, 1);

  schicht.entsorgen();
  assert.equal(schicht.anzahl, 0);
  assert.equal(schicht.gruppe.children.length, 0);
});

test('Ebene I4/8 — nachziehen ist gedrosselt und schaltet die Sprites', () => {
  const schicht = B.neueSchicht({ canvasFabrik: fakeCanvas });
  schicht.abgleichen([
    { id: 1, text: 'Ost', klasse: 'ort', groesse: 1, x: 0, y: 0, z: 0 },
    { id: 2, text: 'West', klasse: 'ort', groesse: 1, x: 1, y: 0, z: 0 }
  ]);
  // Beide auf denselben Bildpunkt projiziert: eine muss weichen.
  const sicht = {
    projiziere: () => ({ x: 0, y: 0, z: 0.5 }),
    breite: 1600, hoehe: 900, massstab: 100, fov: 30, erzwinge: true
  };
  const s1 = schicht.nachziehen(sicht, 0);
  assert.equal(s1.size, 1, 'zwei Beschriftungen aufeinander -> eine bleibt');

  // Ohne erzwinge und innerhalb des Takts wird gar nicht neu bewertet.
  sicht.erzwinge = false;
  const vorTakt = schicht.nachziehen(sicht, B.TAKT_MS - 1);
  assert.equal(vorTakt, s1, 'innerhalb des Takts kommt dieselbe Menge zurueck');
  assert.equal(schicht.nachziehen(sicht, B.TAKT_MS * 3).size, 1);
});

test('Ebene I4/8 — im Aufnahme-Modus gibt es keinen Treffer und keinen Zeiger', () => {
  const schicht = B.neueSchicht({ canvasFabrik: fakeCanvas });
  schicht.abgleichen([{ id: 1, text: 'Ost', klasse: 'ort', groesse: 1, x: 0, y: 0, z: 0,
    ziel: { art: 'extern', ref: 'https://example.com/' } }]);
  const sprite = schicht.gruppe.children[0];
  sprite.visible = true;
  const raycaster = { intersectObjects: () => [{ object: sprite }] };

  assert.equal(schicht.treffer(raycaster, false).id, 1);
  assert.equal(schicht.treffer(raycaster, true), null, 'das Bild soll ein Bild sein');
  assert.equal(schicht.zeigerFuer(raycaster, {}), 'pointer');
  assert.equal(schicht.zeigerFuer(raycaster, { aufnahme: true }), '');

  const rufe = [];
  assert.equal(schicht.klick(raycaster, { fenster: { open: (...a) => rufe.push(a) } }), true);
  assert.equal(rufe.length, 1);
  assert.equal(schicht.klick(raycaster, { aufnahme: true, fenster: { open: () => rufe.push(1) } }), false);
  assert.equal(rufe.length, 1);

  // Unsichtbare Beschriftungen sind auch nicht klickbar.
  sprite.visible = false;
  assert.equal(schicht.treffer(raycaster, false), null);
});

test('Ebene I4/7 — spriteBildhoehe ist endlich und faellt mit dem Abstand', () => {
  const nah = B.spriteBildhoehe(2, 50, 30, 900);
  const fern = B.spriteBildhoehe(2, 500, 30, 900);
  assert.ok(Number.isFinite(nah) && nah > 0);
  assert.ok(fern < nah);
  assert.ok(Number.isFinite(B.spriteBildhoehe(2, 0, 30, 900)), 'Abstand 0 darf nicht NaN geben');
});
