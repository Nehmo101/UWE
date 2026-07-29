/* Luftarchipel: getrennte Registrierung fuer Biom und Editor-Schemata. */

import { erstelleLuftarchipelBiom } from '../core/luftbiom.js';

/** Ergaenzt eine externe oder isolierte Registry genau einmal. */
export function registriereLuftbiom(registry) {
  if (!registry || registry.luftarchipel) return;
  registry.luftarchipel = erstelleLuftarchipelBiom();
}

/** Luftwerkzeuge an die offenen Varianten-/Parameter-Tabellen haengen. */
export function registriereLuftWerkzeuge(varianten, params) {
  if (!varianten || !params) throw new TypeError('Luftwerkzeuge brauchen Tabellen');
  if (!params['pfad:flugroute']) {
    varianten.pfad.push(['flugroute', 'Flugroute']);
    params['pfad:flugroute'] = [
      { k: 'fahrzeug', l: 'Verkehr', o: [
        ['schiff', 'Flugschiffe'], ['zug', 'Flugzuege'], ['gemischt', 'Gemischt']
      ], d: 'gemischt' },
      { k: 'fraktion', l: 'Fraktion', o: [
        ['menschenbund', 'Menschenbund'], ['mondelfen', 'Mondelfen'],
        ['tiefenzwerge', 'Tiefenzwerge'], ['goblinzunft', 'Goblinzunft'],
        ['orklegion', 'Orklegion']
      ], d: 'menschenbund' },
      { k: 'hoehe', l: 'Flughoehe', min: 18, max: 180, st: 1, d: 55 },
      { k: 'verkehr', l: 'Fahrzeuge', min: 1, max: 8, st: 1, d: 3 },
      { k: 'geschwindigkeit', l: 'Tempo', min: 0.15, max: 2.5, st: 0.05, d: 0.75 },
      { k: 'routeSichtbar', l: 'Routenlinie', b: true, d: true },
      { k: 'stationen', l: 'Luftbojen', b: true, d: true }
    ];
  }
  if (!params['objekt:luftinseln']) {
    varianten.objekt.push(['luftinseln', 'Luftarchipel']);
    params['objekt:luftinseln'] = [
      { k: 'anzahl', l: 'Inseln', min: 1, max: 18, st: 1, d: 5 },
      { k: 'streuung', l: 'Archipelradius', min: 8, max: 90, st: 1, d: 32 },
      { k: 'groesse', l: 'Inselgroesse', min: 0.55, max: 3.8, st: 0.05, d: 1.25 },
      { k: 'hoehe', l: 'Schwebehoehe', min: 15, max: 220, st: 1, d: 70 },
      { k: 'form', l: 'Form', o: [
        ['gemischt', 'Gemischt'], ['fels', 'Felsinsel'],
        ['scherbe', 'Schwebescherbe'], ['tafel', 'Plateau'],
        ['archipel', 'Bewohnbares Archipel']
      ], d: 'gemischt' },
      { k: 'bewuchs', l: 'Bewuchs', b: true, d: true }
    ];
  }
  if (!params['objekt:bambushain']) {
    varianten.objekt.push(['bambushain', 'Riesenbambushain']);
    params['objekt:bambushain'] = [
      { k: 'anzahl', l: 'Halme', min: 8, max: 180, st: 1, d: 72 },
      { k: 'streuung', l: 'Hainradius', min: 2, max: 45, st: 0.5, d: 14 },
      { k: 'hoehe', l: 'Wuchshoehe', min: 8, max: 160, st: 1, d: 52 },
      { k: 'dicke', l: 'Halmdicke', min: 0.45, max: 2.8, st: 0.05, d: 1 },
      { k: 'dichte', l: 'Dichte', min: 0.35, max: 2.5, st: 0.05, d: 1.35 },
      { k: 'junganteil', l: 'Jungbambus', min: 0, max: 0.7, st: 0.05, d: 0.18 }
    ];
  }
}