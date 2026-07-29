// Adapter der Luftinsel- und Hochbambus-Generatoren an das Objektwerkzeug.
import { clamp, rngOf, rr } from '../core/rng.js';
import { WATER } from '../core/store.js';
import { heightAt } from '../world/terrain.js';
import { emit } from '../core/pools.js';
import { genLuftinselFormation } from './luftinseln.js';
import { genHochbambusHain } from './hochbambus.js';

function bepflanzeInseln(el, inseln) {
  var gesetzt = 0;
  for (var i = 0; i < inseln.length; i++) {
    var insel = inseln[i];
    if (!insel.gesetzt || insel.plateauRadius < 1.2) continue;
    var rng = rngOf(((el.seed || 0) + i * 7919 + 0x51a7) | 0);
    var n = clamp(Math.round(insel.plateauRadius * 0.34), 1, 5);
    for (var k = 0; k < n; k++) {
      var a = rng() * Math.PI * 2;
      var r = k ? Math.sqrt(rng()) * insel.plateauRadius * 0.42 : 0;
      var pool = rng() < 0.42 ? 'bluetenbaum' : (rng() < 0.72 ? 'baum2' : 'busch');
      var groesse = rr(rng, 0.42, 0.86) * Math.min(1.35, Math.max(0.72, insel.sx));
      var vorher = el.inst[pool] ? el.inst[pool].length : 0;
      emit(el, pool, insel.x + Math.cos(a) * r, insel.plateauY,
        insel.z + Math.sin(a) * r, rng() * Math.PI * 2,
        groesse, groesse, groesse, [0.94, 0.98, 0.94]);
      if (el.inst[pool] && el.inst[pool].length === vorher + 12) gesetzt++;
    }
  }
  return gesetzt;
}

export function genLuftarchipelObjekt(el) {
  var p = el.params || {};
  var form = p.form && p.form !== 'gemischt' ? p.form : undefined;
  var groesse = Number.isFinite(p.groesse) ? p.groesse : 1.25;
  var ergebnis = genLuftinselFormation(el, {
    anzahl: p.anzahl, radius: p.streuung, hoehe: p.hoehe, form: form,
    minGroesse: Math.max(0.35, groesse * 0.56),
    maxGroesse: groesse, hoehenStreuung: 0.24
  });
  var bewuchs = p.bewuchs === false ? 0 : bepflanzeInseln(el, ergebnis.inseln);
  el.kennzahl = ergebnis.gesetzt;
  ergebnis.bewuchs = bewuchs;
  return ergebnis;
}

export function genRiesenbambusObjekt(el) {
  var p = el.params || {};
  var ergebnis = genHochbambusHain(el, {
    anzahl: p.anzahl, radius: p.streuung, hoehe: p.hoehe,
    breite: p.dicke, dichte: p.dichte, junganteil: p.junganteil,
    hoehenVariation: 0.20,
    bodenAn: function (x, z) { return Math.max(heightAt(x, z), WATER); }
  });
  el.kennzahl = ergebnis.staengel;
  return ergebnis;
}
