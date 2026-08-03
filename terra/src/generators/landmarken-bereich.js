import { clamp } from '../core/rng.js';

export const LANDMARKEN_BEREICHE = Object.freeze({
  ort: Object.freeze({ skala: 0.72, ausbau: 1 }),
  region: Object.freeze({ skala: 1, ausbau: 2 }),
  nation: Object.freeze({ skala: 1.42, ausbau: 3 })
});

export function landmarkenBereich(params) {
  var id = params && LANDMARKEN_BEREICHE[params.bereich]
    ? params.bereich : 'region';
  return Object.freeze({ id: id,
    skala: LANDMARKEN_BEREICHE[id].skala,
    ausbau: LANDMARKEN_BEREICHE[id].ausbau });
}

export function landmarkenSkala(params, min, max) {
  var basis = clamp(Number(params && params.groesse) || 1, min, max);
  return basis * landmarkenBereich(params).skala;
}
