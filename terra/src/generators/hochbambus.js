/*
 * Dichte Hochbambus-Haine aus drei instanzierten Pooltypen.
 *
 * Ein Kronendach-Horst enthaelt sieben Halme in einer Geometrie. Auch ein
 * Hain mit rund 3000 sichtbaren Staengeln bleibt deshalb bei drei Draw Calls
 * und hoechstens 512 Runtime-Instanzen.
 */
import { clamp, hashi, rngOf, rr } from '../core/rng.js';
import { HALF } from '../core/store.js';
import { POOLS, emit, tintOf } from '../core/pools.js';
import { heightAt } from '../world/terrain.js';
import {
  HOCHBAMBUS_BASIS_HOEHEN,
  HOCHBAMBUS_POOL_IDS,
  HOCHBAMBUS_STAENGEL_PRO_INSTANZ
} from '../assets/hochbambus-assets.js';

export const HOCHBAMBUS_MAX_HORSTE = 512;
export const HOCHBAMBUS_MAX_HOEHE = 320;

function endlich(wert, fallback) {
  return Number.isFinite(wert) ? wert : fallback;
}

function punkteFuer(el, optionen) {
  if (Array.isArray(optionen.punkte) && optionen.punkte.length) return optionen.punkte;
  if (Number.isFinite(optionen.x) && Number.isFinite(optionen.z)) {
    return [{ x: optionen.x, z: optionen.z }];
  }
  return el.points && el.points.length ? el.points : [{ x: 0, z: 0 }];
}

function poolFuer(rng, norm, optionen) {
  if (optionen.pool && HOCHBAMBUS_BASIS_HOEHEN[optionen.pool]) return optionen.pool;
  var w = rng();
  // Am Hainrand steht mehr Jungwuchs; einzelne Ueberstaender brechen das Dach.
  var jungAnteil = clamp(endlich(optionen.junganteil, 0.10), 0, 0.7);
  var jung = clamp(jungAnteil * (0.5 + norm), 0, 0.7);
  var hoch = 0.12 + (1 - norm) * 0.05;
  if (w < jung) return HOCHBAMBUS_POOL_IDS.jung;
  if (w < jung + hoch) return HOCHBAMBUS_POOL_IDS.hoch;
  return HOCHBAMBUS_POOL_IDS.kronendach;
}

function bodenFuer(optionen, x, z) {
  var fn = typeof optionen.bodenAn === 'function' ? optionen.bodenAn : heightAt;
  var y = Number(fn(x, z));
  return Number.isFinite(y) ? y : 0;
}

/**
 * Reine, deterministische Planung. Praktisch fuer Vorschauen, Tests und fuer
 * Luftinseln, die einen eigenen `bodenAn`-Callback liefern.
 */
export function planeHochbambusHain(el, optionen) {
  if (!el) throw new TypeError('planeHochbambusHain braucht ein Element');
  optionen = optionen || {};
  var punkte = punkteFuer(el, optionen);
  var dichte = clamp(endlich(optionen.dichte, 1), 0.05, 5);
  var basisHorste = endlich(optionen.horste,
    endlich(optionen.anzahl, 96));
  var anzahl = clamp(Math.round(basisHorste * dichte), 1,
    clamp(Math.round(endlich(optionen.maxHorste, HOCHBAMBUS_MAX_HORSTE)),
      1, HOCHBAMBUS_MAX_HORSTE));
  var radius = clamp(endlich(optionen.radius, 32), 0, 480);
  var zielHoehe = clamp(endlich(optionen.hoehe, 72), 6, HOCHBAMBUS_MAX_HOEHE);
  var variation = clamp(endlich(optionen.hoehenVariation, 0.24), 0, 0.72);
  var breite = clamp(endlich(optionen.breite, 1), 0.25, 3.5);
  var seed = (endlich(optionen.seed, el.seed || 0) | 0);
  var plan = [];

  for (var i = 0; i < anzahl; i++) {
    var punktIndex = i % punkte.length;
    var lokal = Math.floor(i / punkte.length);
    var lokalAnzahl = Math.ceil((anzahl - punktIndex) / punkte.length);
    var mitte = punkte[punktIndex];
    var rng = rngOf((hashi(lokal, punktIndex, seed + 0x91d) * 4294967296) | 0);
    var norm = lokalAnzahl <= 1 ? 0 :
      (lokal + 0.26 + rng() * 0.48) / lokalAnzahl;
    var dist = radius * Math.sqrt(Math.min(1, norm));
    var winkel = lokal * 2.399963229728653 + punktIndex * 0.83
      + (rng() - 0.5) * 0.34;
    var x = mitte.x + Math.cos(winkel) * dist;
    var z = mitte.z + Math.sin(winkel) * dist;
    if (optionen.klemmen !== false) {
      x = clamp(x, -HALF + 1, HALF - 1);
      z = clamp(z, -HALF + 1, HALF - 1);
    }
    if (typeof optionen.akzeptiert === 'function' &&
        !optionen.akzeptiert(x, z, norm)) continue;
    var pool = poolFuer(rng, norm, optionen);
    var basis = HOCHBAMBUS_BASIS_HOEHEN[pool];
    var typFaktor = pool === HOCHBAMBUS_POOL_IDS.hoch
      ? rr(rng, 1.10, 1.42)
      : pool === HOCHBAMBUS_POOL_IDS.jung
        ? rr(rng, 0.42, 0.67)
        : rr(rng, 0.84, 1.12);
    var hoehe = Math.min(HOCHBAMBUS_MAX_HOEHE,
      zielHoehe * typFaktor * rr(rng, 1 - variation, 1 + variation));
    var quer = breite * rr(rng, 0.78, 1.18);
    plan.push({
      pool,
      x,
      y: bodenFuer(optionen, x, z),
      z,
      yaw: rng() * Math.PI * 2,
      sx: quer,
      sy: hoehe / basis,
      sz: quer * rr(rng, 0.88, 1.12),
      tint: tintOf(rng, 0.075),
      zielHoehe: hoehe,
      staengel: HOCHBAMBUS_STAENGEL_PRO_INSTANZ[pool]
    });
  }
  return plan;
}

/**
 * Emittiert den Plan in die normalen Poolvertraege. Keine eigenen Meshes,
 * keine Materialklone und keine Draw Calls pro Halm.
 */
export function genHochbambusHain(el, optionen) {
  if (!el || !el.inst) throw new TypeError('genHochbambusHain braucht ein Element');
  var ids = Object.values(HOCHBAMBUS_POOL_IDS);
  for (var i = 0; i < ids.length; i++) {
    if (!POOLS[ids[i]]) throw new Error('Hochbambus-Pool nicht registriert: ' + ids[i]);
  }
  var plan = planeHochbambusHain(el, optionen || {});
  var vorher = el.total;
  var staengel = 0;
  var nachPool = {
    bambus_hoch: 0,
    bambus_kronendach: 0,
    bambus_jung: 0
  };
  for (i = 0; i < plan.length; i++) {
    var p = plan[i];
    var laengeVorher = el.inst[p.pool] ? el.inst[p.pool].length : 0;
    emit(el, p.pool, p.x, p.y, p.z, p.yaw, p.sx, p.sy, p.sz, p.tint);
    var laengeNachher = el.inst[p.pool] ? el.inst[p.pool].length : 0;
    if (laengeNachher === laengeVorher + 12) {
      nachPool[p.pool]++;
      staengel += p.staengel;
    }
  }
  return {
    geplant: plan.length,
    instanzen: el.total - vorher,
    staengel,
    pools: nachPool,
    plan
  };
}
