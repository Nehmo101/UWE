/*
 * Poolbasierte Luftinseln fuer Luftbiome, freie Formationen und Landmarken.
 * Keine UI-Annahmen: Root kann einzelne Inseln oder ganze Felder aus jedem
 * Werkzeug heraus emittieren.
 */
import { clamp, hashi, rngOf, rr } from '../core/rng.js';
import { HALF } from '../core/store.js';
import { POOLS, emit } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import {
  LUFTINSEL_FORMEN,
  LUFTINSEL_POOL_IDS
} from '../assets/luftinsel-assets.js';

export const LUFTINSEL_MAX_PRO_FORMATION = 64;

function endlich(wert, fallback) {
  return Number.isFinite(wert) ? wert : fallback;
}

function formName(form, seed) {
  if (LUFTINSEL_POOL_IDS[form]) return form;
  var index = Math.floor(hashi(seed | 0, 31, 0x7151) * LUFTINSEL_FORMEN.length);
  return LUFTINSEL_FORMEN[Math.min(LUFTINSEL_FORMEN.length - 1, index)];
}

function bodenHoehe(optionen, x, z) {
  if (Number.isFinite(optionen.bodenY)) return optionen.bodenY;
  var fn = typeof optionen.bodenAn === 'function' ? optionen.bodenAn : heightAt;
  var wert = Number(fn(x, z));
  return Number.isFinite(wert) ? wert : 0;
}

function tintFuer(seed, angegeben) {
  if (Array.isArray(angegeben) && angegeben.length >= 3) {
    return [angegeben[0], angegeben[1], angegeben[2]];
  }
  var hell = 0.94 + hashi(seed, 13, 0x71f3) * 0.12;
  var kuehl = (hashi(seed, 17, 0x7241) - 0.5) * 0.035;
  return [hell - kuehl * 0.35, hell, hell + kuehl];
}

/**
 * Eine einzelne Insel. Der Ursprung liegt an ihrer Plateaukante; der felsige
 * Koerper waechst nach unten. Rueckgabe enthaelt einen sicheren Bauanker fuer
 * Burgen, Bambushaine oder Luftschiffe.
 */
export function emittiereLuftinsel(el, optionen) {
  if (!el || !el.inst) throw new TypeError('emittiereLuftinsel braucht ein Element');
  optionen = optionen || {};
  var seed = (endlich(optionen.seed, el.seed || 0) | 0);
  var form = formName(optionen.form, seed);
  var poolId = LUFTINSEL_POOL_IDS[form];
  var pool = POOLS[poolId];
  if (!pool) {
    throw new Error('Luftinsel-Pool nicht registriert: ' + poolId);
  }

  var x = endlich(optionen.x, 0);
  var z = endlich(optionen.z, 0);
  if (optionen.klemmen !== false) {
    x = clamp(x, -HALF + 2, HALF - 2);
    z = clamp(z, -HALF + 2, HALF - 2);
  }
  var schwebehoehe = clamp(endlich(optionen.hoehe, 64), 2, 600);
  var y = Number.isFinite(optionen.y)
    ? optionen.y
    : bodenHoehe(optionen, x, z) + schwebehoehe;

  var groesse = clamp(endlich(optionen.groesse, 1), 0.18, 12);
  var sx = groesse * clamp(endlich(optionen.breite, 1), 0.25, 4);
  var sy = groesse * clamp(endlich(optionen.maechtigkeit, 1), 0.22, 4);
  var sz = groesse * clamp(endlich(optionen.tiefe, 1), 0.25, 4);
  var yaw = endlich(optionen.drehung, hashi(seed, 7, 0x73b1) * Math.PI * 2);
  var vorher = el.inst[poolId] ? el.inst[poolId].length : 0;
  emit(el, poolId, x, y, z, yaw, sx, sy, sz,
    tintFuer(seed, optionen.tint), optionen.neigungX || 0, optionen.neigungZ || 0);
  var nachher = el.inst[poolId] ? el.inst[poolId].length : 0;
  if (!pool.geo.boundingBox) pool.geo.computeBoundingBox();
  var oberkante = pool.geo.boundingBox ? pool.geo.boundingBox.max.y : 0.1;
  var unterkante = pool.geo.boundingBox
    ? pool.geo.boundingBox.min.y
    : -(pool.geo.userData.terraLuftinselBasisTiefe || 8);

  var plateauBasis = pool.geo.userData.terraLuftinselPlateauRadius
    || pool.radius * 0.5;
  return {
    gesetzt: nachher === vorher + 12,
    pool: poolId,
    form,
    x,
    y,
    z,
    sx,
    sy,
    sz,
    drehung: yaw,
    plateauY: y + oberkante * Math.abs(sy),
    plateauRadius: plateauBasis * Math.min(Math.abs(sx), Math.abs(sz)),
    unterkanteY: y + unterkante * Math.abs(sy)
  };
}

function formationPunkte(el, optionen) {
  if (Array.isArray(optionen.punkte) && optionen.punkte.length) return optionen.punkte;
  if (Number.isFinite(optionen.x) && Number.isFinite(optionen.z)) {
    return [{ x: optionen.x, z: optionen.z }];
  }
  return el.points && el.points.length ? el.points : [{ x: 0, z: 0 }];
}

/**
 * Gleichmaessig, aber nicht technisch gerasterte Formation. Der goldene Winkel
 * verhindert Klumpen; ein kleiner deterministischer Jitter bricht die Spirale.
 */
export function genLuftinselFormation(el, optionen) {
  optionen = optionen || {};
  var punkte = formationPunkte(el, optionen);
  var gesamt = clamp(Math.round(endlich(optionen.anzahl, 7)), 1,
    LUFTINSEL_MAX_PRO_FORMATION);
  var radius = clamp(endlich(optionen.radius, 42), 0, 480);
  var basisHoehe = clamp(endlich(optionen.hoehe, 76), 4, 600);
  var hoehenStreuung = clamp(endlich(optionen.hoehenStreuung, 0.32), 0, 1);
  var minGroesse = clamp(endlich(optionen.minGroesse, 0.55), 0.18, 12);
  var maxGroesse = clamp(endlich(optionen.maxGroesse, 2.1), minGroesse, 12);
  var seed = (endlich(optionen.seed, el.seed || 0) | 0);
  var ergebnis = [];
  var proPunkt = Math.max(1, Math.ceil(gesamt / punkte.length));
  var index = 0;

  for (var p = 0; p < punkte.length && index < gesamt; p++) {
    var mitte = punkte[p];
    var rng = rngOf((hashi(p, seed, 0x7499) * 4294967296) | 0);
    for (var k = 0; k < proPunkt && index < gesamt; k++, index++) {
      var norm = proPunkt <= 1 ? 0 : (k + 0.32 + rng() * 0.36) / proPunkt;
      var dist = radius * Math.sqrt(norm);
      var winkel = k * 2.399963229728653 + p * 0.71 + (rng() - 0.5) * 0.34;
      var groesse = rr(rng, minGroesse, maxGroesse);
      // Wenige grosse Ankerinseln, viele kleinere Begleiter.
      if (k === 0) groesse = maxGroesse;
      else groesse *= 0.72 + Math.pow(1 - norm, 1.4) * 0.36;
      var form = optionen.form;
      if (!LUFTINSEL_POOL_IDS[form]) {
        var f = Math.floor(rng() * LUFTINSEL_FORMEN.length);
        form = LUFTINSEL_FORMEN[Math.min(LUFTINSEL_FORMEN.length - 1, f)];
      }
      ergebnis.push(emittiereLuftinsel(el, {
        x: mitte.x + Math.cos(winkel) * dist,
        z: mitte.z + Math.sin(winkel) * dist,
        form,
        groesse,
        breite: rr(rng, 0.82, 1.22),
        tiefe: rr(rng, 0.78, 1.18),
        maechtigkeit: rr(rng, 0.78, 1.28),
        hoehe: basisHoehe * rr(rng, 1 - hoehenStreuung, 1 + hoehenStreuung),
        bodenAn: optionen.bodenAn,
        bodenY: optionen.bodenY,
        drehung: rng() * Math.PI * 2,
        seed: seed + index * 977 + p * 7919,
        klemmen: optionen.klemmen,
        tint: optionen.tint
      }));
    }
  }
  return {
    angefordert: gesamt,
    gesetzt: ergebnis.filter(function (insel) { return insel.gesetzt; }).length,
    inseln: ergebnis
  };
}
