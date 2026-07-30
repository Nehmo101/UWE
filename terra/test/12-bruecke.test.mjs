/* ==========================================================================
   Ebene 7 — Die Brücke (J1)

   Geprüft wird die TERRA-Seite der Einbettung: was sie annimmt, was sie
   abweist, und wann sie überhaupt aufwacht. Die Elternseite (Studio/Portal)
   liegt außerhalb dieses Testlaufs; ihre Rechteprüfung steht in
   packages/database/src/terra-service.test.ts.

   Die drei Zusagen aus dem Kopf von editor/bruecke.js sind hier je einzeln
   nachgestellt:
     1. außerhalb eines Rahmens vollständig inaktiv
     2. Herkunft UND Absender werden geprüft (nicht nur eines)
     3. gesendet wird an location.origin, nie an "*"

   Warum ein selbstgebautes Fenster statt eines DOM-Ersatzes: die Brücke
   fasst window nur an drei Stellen an (addEventListener, setTimeout,
   parent.postMessage). Ein Fenster mit HANDBETRIEBENER Uhr macht die
   Entprellung prüfbar, ohne echte Zeit verstreichen zu lassen — ein
   `await sleep(1300)` je Fall wäre langsam und flackerte auf langsamen
   Rechnern.

   `globalThis.window` wird je Fall gesetzt UND wieder entfernt: die übrigen
   Ebenen laufen bewusst ohne window (siehe hilfen/dom-stub.mjs), und alle
   Testdateien teilen sich über index.mjs einen Prozess.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';

const HERKUNFT = 'https://studio.example';

/** Ein Fenster mit Handbetrieb: Uhr, Zuhörer und Postausgang sind Daten. */
function baueFenster(opt = {}) {
  const zuhoerer = new Map();
  const postausgang = [];
  const uhr = [];
  const eltern = {
    postMessage(nachricht, ziel) { postausgang.push({ nachricht, ziel }); },
  };
  const w = {
    location: { origin: opt.origin ?? HERKUNFT, search: opt.search ?? '' },
    addEventListener(typ, fn) {
      if (!zuhoerer.has(typ)) zuhoerer.set(typ, []);
      zuhoerer.get(typ).push(fn);
    },
    removeEventListener(typ, fn) {
      const liste = zuhoerer.get(typ) || [];
      const i = liste.indexOf(fn);
      if (i >= 0) liste.splice(i, 1);
    },
    setTimeout(fn) { uhr.push(fn); return uhr.length; },
    clearTimeout(nr) { if (nr) uhr[nr - 1] = null; },
  };
  w.parent = opt.eigenerTab ? w : eltern;
  return {
    w,
    eltern,
    postausgang,
    /** Löst alle offenen Zeitgeber aus (die Ruhezeit ist abgelaufen). */
    tick() {
      const offen = uhr.splice(0, uhr.length);
      for (const fn of offen) if (fn) fn();
    },
    offeneZeitgeber() { return uhr.filter(Boolean).length; },
    /** Stellt ein eingehendes Ereignis zu. */
    sende(typ, ereignis) {
      for (const fn of zuhoerer.get(typ) || []) fn(ereignis);
    },
    hatZuhoerer(typ) { return (zuhoerer.get(typ) || []).length > 0; },
  };
}

/** Ein Terra-Ersatz: liefert einen Dateitext und merkt sich Übernahmen. */
function baueWege(start = '{"format":"terra","version":5,"a":1}') {
  const zustand = { text: start, uebernommen: [], wirft: null };
  return {
    zustand,
    wege: {
      text() { return zustand.text; },
      uebernehmen(t) {
        if (zustand.wirft) throw new Error(zustand.wirft);
        zustand.uebernommen.push(t);
        // Terra normiert beim Übernehmen — der Text danach ist ein anderer.
        zustand.text = JSON.stringify({ ...JSON.parse(t), normiert: true });
      },
    },
  };
}

/** Führt einen Fall mit gesetztem globalThis.window aus und räumt danach auf. */
async function imFenster(fenster, lauf) {
  const bruecke = await ladeTerra('editor/bruecke.js');
  const vorher = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  if (fenster) globalThis.window = fenster.w;
  try {
    await lauf(bruecke);
  } finally {
    bruecke.brueckeZuruecksetzen();
    if (!vorher) delete globalThis.window;
  }
}

function ladeNachricht(fenster, daten, version = 1) {
  return { origin: fenster.w.location.origin, source: fenster.eltern, data: { typ: 'karte-laden', daten, version } };
}

/* --- 1. Inaktiv, wo sie inaktiv sein muss ------------------------------- */

test('Ebene 7 — ohne window bleibt die Bruecke vollstaendig still', async () => {
  const bruecke = await ladeTerra('editor/bruecke.js');
  const { wege, zustand } = baueWege();
  assert.equal(typeof globalThis.window, 'undefined',
    'Vorbedingung: die uebrigen Ebenen laufen ohne window');
  bruecke.setzeBrueckenWege(wege);
  assert.equal(bruecke.brueckeAktiv(), false);
  assert.deepEqual(zustand.uebernommen, [], 'nichts uebernommen');
  bruecke.brueckeZuruecksetzen();
});

test('Ebene 7 — im eigenen Tab (window.parent === window) bleibt sie still', async () => {
  const f = baueFenster({ eigenerTab: true });
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(baueWege().wege);
    assert.equal(bruecke.brueckeAktiv(), false);
    assert.equal(f.postausgang.length, 0, 'kein terra-bereit ohne Rahmen');
    assert.equal(f.hatZuhoerer('message'), false, 'kein message-Zuhoerer');
  });
});

test('Ebene 7 — bei Herkunft "null" (file://) bleibt sie still', async () => {
  // Doppelklick auf terra/index.html: postMessage mit dem Ziel "null" wuerde
  // werfen. Lieber gar nicht einbetten als eine Ausnahme beim Start.
  const f = baueFenster({ origin: 'null' });
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(baueWege().wege);
    assert.equal(bruecke.brueckeAktiv(), false);
  });
});

/* --- 2. Der Bereitschaftsgruss ------------------------------------------ */

test('Ebene 7 — meldet terra-bereit an die eigene Herkunft, nie an "*"', async () => {
  const f = baueFenster();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(baueWege().wege);
    assert.equal(bruecke.brueckeAktiv(), true);
    assert.equal(f.postausgang.length, 1);
    assert.equal(f.postausgang[0].nachricht.typ, 'terra-bereit');
    assert.equal(f.postausgang[0].nachricht.protokoll, bruecke.BRUECKE_PROTOKOLL);
    assert.equal(f.postausgang[0].ziel, HERKUNFT);
    assert.notEqual(f.postausgang[0].ziel, '*');
  });
});

/* --- 3. Beide Pruefungen beim Empfang ----------------------------------- */

test('Ebene 7 — eine Karte aus fremder Herkunft wird abgewiesen', async () => {
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', {
      origin: 'https://boese.example',
      source: f.eltern,
      data: { typ: 'karte-laden', daten: { format: 'terra', version: 5 }, version: 9 },
    });
    assert.deepEqual(zustand.uebernommen, []);
    assert.equal(bruecke.brueckeZustand().version, null, 'auch die Version bleibt unberuehrt');
  });
});

test('Ebene 7 — eine Karte von einem Geschwisterframe wird abgewiesen', async () => {
  // Gleiche Herkunft, aber NICHT das Elternfenster. Genau der Fall, den eine
  // reine origin-Pruefung durchliesse.
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  const geschwister = { postMessage() {} };
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', {
      origin: HERKUNFT,
      source: geschwister,
      data: { typ: 'karte-laden', daten: { format: 'terra', version: 5 }, version: 9 },
    });
    assert.deepEqual(zustand.uebernommen, []);
  });
});

test('Ebene 7 — eine Karte vom Elternfenster derselben Herkunft wird uebernommen', async () => {
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', ladeNachricht(f, { format: 'terra', version: 5, karten: [] }, 7));
    assert.equal(zustand.uebernommen.length, 1);
    assert.deepEqual(JSON.parse(zustand.uebernommen[0]), { format: 'terra', version: 5, karten: [] });
    assert.equal(bruecke.brueckeZustand().version, 7, 'die Version reist mit');
  });
});

test('Ebene 7 — eine unlesbare Karte meldet terra-fehler und laesst den Editor stehen', async () => {
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  zustand.wirft = 'Unbekanntes Format';
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', ladeNachricht(f, { kaputt: true }, 3));
    const fehler = f.postausgang.filter((p) => p.nachricht.typ === 'terra-fehler');
    assert.equal(fehler.length, 1);
    assert.match(fehler[0].nachricht.meldung, /Unbekanntes Format/);
    assert.equal(fehler[0].ziel, HERKUNFT);
  });
});

/* --- 4. Heraus: entprellt, und nur bei echter Aenderung ------------------ */

test('Ebene 7 — Aenderungen gehen entprellt heraus, gleiche Staende nicht', async () => {
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', ladeNachricht(f, { format: 'terra', version: 5 }, 4));
    f.postausgang.length = 0;

    // Drei Bedienschritte, aber nur EIN Zeitgeber: das ist die Entprellung.
    f.sende('pointerup', {});
    f.sende('keyup', {});
    f.sende('wheel', {});
    assert.equal(f.offeneZeitgeber(), 1);
    assert.equal(f.postausgang.length, 0, 'vor Ablauf der Ruhezeit geht nichts hinaus');

    // Nichts hat sich wirklich geaendert -> keine Nachricht.
    f.tick();
    assert.equal(f.postausgang.length, 0, 'gleicher Stand, kein Verkehr');

    // Jetzt eine echte Aenderung.
    zustand.text = JSON.stringify({ format: 'terra', version: 5, neu: 1 });
    f.sende('pointerup', {});
    f.tick();
    assert.equal(f.postausgang.length, 1);
    const n = f.postausgang[0].nachricht;
    assert.equal(n.typ, 'karte-geaendert');
    assert.equal(n.version, 4, 'die zuletzt bestaetigte Version reist mit zurueck');
    assert.deepEqual(n.daten, { format: 'terra', version: 5, neu: 1 });
    assert.equal(f.postausgang[0].ziel, HERKUNFT);
  });
});

test('Ebene 7 — beforeunload meldet sofort, ohne die Ruhezeit abzuwarten', async () => {
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', ladeNachricht(f, { format: 'terra', version: 5 }, 1));
    f.postausgang.length = 0;

    zustand.text = JSON.stringify({ format: 'terra', version: 5, letzterStrich: true });
    f.sende('pointerup', {});
    assert.equal(f.postausgang.length, 0, 'die Ruhezeit laeuft noch');

    f.sende('beforeunload', {});
    assert.equal(f.postausgang.length, 1, 'der Flush hat gemeldet');
    assert.equal(f.postausgang[0].nachricht.typ, 'karte-geaendert');
    assert.equal(f.offeneZeitgeber(), 0, 'der offene Zeitgeber wurde abgeraeumt');
  });
});

test('Ebene 7 — stand-bestaetigt hebt die Version fuer die naechste Meldung', async () => {
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', ladeNachricht(f, { format: 'terra', version: 5 }, 1));
    f.sende('message', { origin: HERKUNFT, source: f.eltern, data: { typ: 'stand-bestaetigt', version: 2 } });
    f.postausgang.length = 0;

    zustand.text = JSON.stringify({ format: 'terra', version: 5, weiter: 1 });
    f.sende('pointerup', {});
    f.tick();
    assert.equal(f.postausgang[0].nachricht.version, 2);
  });
});

test('Ebene 7 — Fensterwechsel erhaelt den aktuellen Stand mit Anfragekennung und Version', async () => {
  const f = baueFenster();
  const { wege, zustand } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.sende('message', ladeNachricht(f, { format: 'terra', version: 5 }, 11));
    f.postausgang.length = 0;

    // Der letzte Strich ist noch nicht entprellt gemeldet. Genau deshalb fragt
    // der Fensterwechsel den Stand direkt beim Frame an.
    zustand.text = JSON.stringify({ format: 'terra', version: 5, letzterStrich: true });
    f.sende('message', {
      origin: HERKUNFT,
      source: f.eltern,
      data: { typ: 'karte-stand-anfordern', anfrageId: 'fenster-abc' },
    });

    assert.equal(f.postausgang.length, 1);
    assert.equal(f.postausgang[0].ziel, HERKUNFT);
    assert.deepEqual(f.postausgang[0].nachricht, {
      typ: 'karte-stand',
      anfrageId: 'fenster-abc',
      daten: { format: 'terra', version: 5, letzterStrich: true },
      version: 11,
    });
  });
});

test('Ebene 7 — Standanfrage verlangt weiterhin Herkunft UND Elternfenster', async () => {
  const f = baueFenster();
  const { wege } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    f.postausgang.length = 0;

    const anfrage = { typ: 'karte-stand-anfordern', anfrageId: 'streng' };
    f.sende('message', { origin: 'https://boese.example', source: f.eltern, data: anfrage });
    f.sende('message', { origin: HERKUNFT, source: { postMessage() {} }, data: anfrage });
    assert.equal(f.postausgang.length, 0);

    f.sende('message', { origin: HERKUNFT, source: f.eltern, data: anfrage });
    assert.equal(f.postausgang.length, 1, 'nur die echte Elternseite erhaelt den Stand');
  });
});

test('Ebene 7 — ungueltige Anfragekennungen werden nicht gespiegelt', async () => {
  const f = baueFenster();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(baueWege().wege);
    f.postausgang.length = 0;
    for (const anfrageId of ['', 7, 'x'.repeat(161)]) {
      f.sende('message', {
        origin: HERKUNFT,
        source: f.eltern,
        data: { typ: 'karte-stand-anfordern', anfrageId },
      });
    }
    assert.equal(f.postausgang.length, 0);
  });
});

/* --- 5. Lesemodus ------------------------------------------------------- */

test('Ebene 7 — im Lesemodus geht nie eine Aenderung hinaus', async () => {
  const f = baueFenster({ search: '?karte=abc&modus=lesen' });
  const { wege, zustand } = baueWege();
  await imFenster(f, (bruecke) => {
    bruecke.setzeBrueckenWege(wege);
    assert.equal(bruecke.brueckeZustand().lesemodus, true);
    assert.equal(f.postausgang[0].nachricht.modus, 'lesen');

    // Die Karte kommt weiterhin herein — nur heraus geht nichts.
    f.sende('message', ladeNachricht(f, { format: 'terra', version: 5 }, 5));
    assert.equal(zustand.uebernommen.length, 1);

    f.postausgang.length = 0;
    zustand.text = JSON.stringify({ format: 'terra', version: 5, gepfuscht: true });
    f.sende('pointerup', {});
    f.tick();
    assert.equal(f.postausgang.length, 0, 'kein karte-geaendert im Lesemodus');
    assert.equal(f.hatZuhoerer('beforeunload'), false, 'auch kein Flush-Zuhoerer');
  });
});

test('Ebene 7 — der Lesemodus blendet Rail, Panel und Leiste aus', async () => {
  const f = baueFenster({ search: '?modus=lesen' });
  await imFenster(f, (bruecke) => {
    for (const id of ['rail', 'panel', 'bar']) document.getElementById(id).style.display = '';
    bruecke.setzeBrueckenWege(baueWege().wege);
    for (const id of ['rail', 'panel', 'bar']) {
      assert.equal(document.getElementById(id).style.display, 'none', id + ' ist ausgeblendet');
    }
    // Was zur Navigation gehoert, bleibt.
    assert.notEqual(document.getElementById('stats').style.display, 'none');
  });
});

test('Ebene 7 — ohne modus=lesen bleibt alles sichtbar', async () => {
  const f = baueFenster({ search: '?karte=abc' });
  await imFenster(f, (bruecke) => {
    for (const id of ['rail', 'panel', 'bar']) document.getElementById(id).style.display = '';
    bruecke.setzeBrueckenWege(baueWege().wege);
    assert.equal(bruecke.brueckeZustand().lesemodus, false);
    for (const id of ['rail', 'panel', 'bar']) {
      assert.notEqual(document.getElementById(id).style.display, 'none');
    }
  });
});
