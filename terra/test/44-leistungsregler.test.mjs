/* ==========================================================================
   Leistungsregler — adaptive Renderaufloesung

   Der Regler ist reine Logik (render/leistungsregler.js) und hier ohne
   WebGL vollstaendig pruefbar: runter bei anhaltend zaehen Bildern, hoch bei
   anhaltend schnellen, traege gegen Einzelruckler, nie unter die letzte und
   nie ueber die erste Stufe. Dazu die Skala-Erweiterung von render-masse.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  erzeugeLeistungsRegler,
  LEISTUNGS_STUFEN
} from '../src/render/leistungsregler.js';
import { berechneRenderMasse } from '../src/render/render-masse.js';

/** Meldet `sekunden` lang Bilder mit `ms` Bildzeit; sammelt Stufenwechsel. */
function laufe(regler, ms, sekunden) {
  const wechsel = [];
  const dt = ms / 1000;
  for (let t = 0; t < sekunden; t += dt) {
    const neu = regler.tick(dt);
    if (neu !== null) wechsel.push(neu);
  }
  return wechsel;
}

test('Leistungsregler - senkt die Skala bei anhaltend zaehen Bildern', () => {
  const regler = erzeugeLeistungsRegler();
  assert.equal(regler.skala(), 1, 'Start ist volle Aufloesung');
  const wechsel = laufe(regler, 90, 4);           // ~11 fps, 4 Sekunden
  assert.ok(wechsel.length >= 1, 'Bei 11 fps muss mindestens eine Stufe fallen');
  assert.ok(regler.skala() < 1);
  assert.deepEqual(wechsel, LEISTUNGS_STUFEN.slice(1, wechsel.length + 1),
    'Die Stufen fallen der Leiter entlang, ohne eine zu ueberspringen');
});

test('Leistungsregler - Einzelruckler kosten keine Schaerfe', () => {
  const regler = erzeugeLeistungsRegler();
  laufe(regler, 16, 3);                           // ruhige 60 fps
  assert.equal(regler.tick(0.25), null, 'Ein einzelner 250-ms-Ruckler');
  laufe(regler, 16, 0.5);
  assert.equal(regler.skala(), 1, 'Die Skala bleibt auf voller Aufloesung');
});

test('Leistungsregler - hebt die Skala erst nach anhaltend schnellen Bildern', () => {
  const regler = erzeugeLeistungsRegler();
  laufe(regler, 90, 4);                           // erst absenken
  const tief = regler.skala();
  assert.ok(tief < 1);
  // Kurz schnell reicht nicht (Hysterese) …
  laufe(regler, 12, 1);
  assert.equal(regler.skala(), tief, 'Eine Sekunde 80 fps hebt noch nichts an');
  // … anhaltend schnell schon.
  laufe(regler, 12, 30);
  assert.equal(regler.skala(), 1, 'Nach anhaltend schnellen Bildern volle Schaerfe');
});

test('Leistungsregler - bleibt innerhalb der Leiter', () => {
  const regler = erzeugeLeistungsRegler();
  laufe(regler, 200, 60);                         // Dauerlast weit unter Schwelle
  assert.equal(regler.skala(), LEISTUNGS_STUFEN[LEISTUNGS_STUFEN.length - 1],
    'Die unterste Stufe ist der Boden');
  assert.equal(regler.tick(0.2), null, 'Unter dem Boden gibt es keinen Wechsel mehr');
});

test('Leistungsregler - ungueltige Bildzeiten werden ignoriert', () => {
  const regler = erzeugeLeistungsRegler();
  assert.equal(regler.tick(0), null);
  assert.equal(regler.tick(-1), null);
  assert.equal(regler.tick(NaN), null);
  assert.equal(regler.skala(), 1);
});

test('render-masse - Skala senkt die Pixeldichte, aber nie unter 0.5', () => {
  // Ohne Skala byteidentisch zum Bestand.
  assert.equal(berechneRenderMasse(1280, 720, 2).pixelRatio, 2);
  assert.equal(berechneRenderMasse(1280, 720, 2, 1).pixelRatio, 2);
  assert.equal(berechneRenderMasse(1280, 720, 2, undefined).pixelRatio, 2);
  // Halbe Skala auf Retina: 2 * 0.5 = 1.
  assert.equal(berechneRenderMasse(1280, 720, 2, 0.5).pixelRatio, 1);
  // Unter DPR 1 darf die Skala fallen — aber nie unter den 0.5-Boden.
  assert.equal(berechneRenderMasse(1280, 720, 1, 0.6).pixelRatio, 0.6);
  assert.equal(berechneRenderMasse(1280, 720, 1, 0.2).pixelRatio, 0.5);
  // Das Tiefenziel folgt der gesenkten Dichte.
  const masse = berechneRenderMasse(1280, 720, 2, 0.5);
  assert.deepEqual([masse.tiefenBreite, masse.tiefenHoehe], [640, 360]);
  // Unsinnige Skalen fallen auf 1 zurueck.
  assert.equal(berechneRenderMasse(1280, 720, 2, 0).pixelRatio, 2);
  assert.equal(berechneRenderMasse(1280, 720, 2, NaN).pixelRatio, 2);
  assert.equal(berechneRenderMasse(1280, 720, 2, 7).pixelRatio, 2);
});
