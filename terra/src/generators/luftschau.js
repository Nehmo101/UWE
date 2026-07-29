/* ==========================================================================
   Luftschau-Demoplan

   Reine, deterministische Daten fuer `?schau=luft`. Das Modul importiert
   weder Store noch Registry und erzeugt keine Runtime-Objekte. Root kann die
   Spezifikationen ueber denselben Elementweg wie geladene Karten einspielen.
   ========================================================================== */

function punkt(x, z) {
  return Object.freeze({ x: x, z: z });
}

function element(kind, variant, points, params) {
  return Object.freeze({
    kind: kind,
    variant: variant,
    points: Object.freeze(points),
    params: Object.freeze(params)
  });
}

export var LUFTSCHAU_KAMERA = Object.freeze({
  x: 0,
  z: 5,
  dist: 315,
  pitch: 0.55,
  yaw: 0.08,
  fov: 40,
  hebung: 58
});

export var LUFTSCHAU_ELEMENTE = Object.freeze([
  /* Fuenf Cluster in einem Element: visuell reich, aber nur je ein Draw Call
     pro Insel- und Bewuchspool. */
  element('objekt', 'luftinseln', [
    punkt(-74, -54), punkt(64, -62), punkt(0, -4),
    punkt(-62, 64), punkt(70, 58)
  ], {
    anzahl: 35, streuung: 29, groesse: 1.92, hoehe: 88,
    form: 'gemischt', bewuchs: true
  }),

  /* Monumentaler Hain im westlichen Mittelgrund: vollstaendige Krone statt
     einer angeschnittenen Vordergrundwand, die den Blick auf die Flotte sperrt. */
  element('objekt', 'bambushain', [
    punkt(-88, -112)
  ], {
    anzahl: 15, streuung: 11, hoehe: 104, dicke: 0.92,
    dichte: 0.78, junganteil: 0.18
  }),

  /* Menschen: ruhige Handelskreuzer auf der tiefen Hauptpassage. */
  element('pfad', 'flugroute', [
    punkt(-118, -52), punkt(-74, -54), punkt(-10, -8),
    punkt(36, 24), punkt(70, 58), punkt(118, 76)
  ], {
    fahrzeug: 'schiff', fraktion: 'menschenbund', hoehe: 68,
    verkehr: 3, geschwindigkeit: 0.64,
    routeSichtbar: true, stationen: true
  }),

  /* Mondelfen: schneller, hoher Flugzug zwischen Nordwest und Ost. */
  element('pfad', 'flugroute', [
    punkt(-108, 78), punkt(-62, 64), punkt(-6, 28),
    punkt(30, -28), punkt(64, -62), punkt(112, -82)
  ], {
    fahrzeug: 'zug', fraktion: 'mondelfen', hoehe: 96,
    verkehr: 3, geschwindigkeit: 1.18,
    routeSichtbar: true, stationen: true
  }),

  /* Tiefenzwerge: dichter Mischverkehr durch den zentralen Werftkorridor. */
  element('pfad', 'flugroute', [
    punkt(-102, -92), punkt(-48, -24), punkt(0, -4),
    punkt(48, 8), punkt(82, 52), punkt(112, 96)
  ], {
    fahrzeug: 'gemischt', fraktion: 'tiefenzwerge', hoehe: 56,
    verkehr: 4, geschwindigkeit: 0.48,
    routeSichtbar: true, stationen: true
  }),

  /* Goblins: riskante Querlinie mit hoher Geschwindigkeit. */
  element('pfad', 'flugroute', [
    punkt(-120, 18), punkt(-62, 64), punkt(4, 52),
    punkt(44, 6), punkt(64, -62), punkt(116, -22)
  ], {
    fahrzeug: 'schiff', fraktion: 'goblinzunft', hoehe: 78,
    verkehr: 3, geschwindigkeit: 1.52,
    routeSichtbar: true, stationen: false
  }),

  /* Orkische Eisenbahn: niedrige, schwere Diagonale am Kartenrand. */
  element('pfad', 'flugroute', [
    punkt(-116, -106), punkt(-54, -82), punkt(8, -38),
    punkt(54, 12), punkt(70, 58), punkt(116, 108)
  ], {
    fahrzeug: 'zug', fraktion: 'orklegion', hoehe: 44,
    verkehr: 3, geschwindigkeit: 0.38,
    routeSichtbar: true, stationen: true
  })
]);

function kopiereElement(vorlage) {
  return {
    kind: vorlage.kind,
    variant: vorlage.variant,
    points: vorlage.points.map(function (p) { return { x: p.x, z: p.z }; }),
    params: Object.assign({}, vorlage.params)
  };
}

/**
 * Gibt bei jedem Aufruf einen frischen, mutierbaren Plan zurueck. Die
 * exportierten Vorlagen bleiben gefroren und koennen nicht durch Editor- oder
 * Generatorzustand veraendert werden.
 */
export function erstelleLuftschauPlan() {
  return {
    kamera: Object.assign({}, LUFTSCHAU_KAMERA),
    elements: LUFTSCHAU_ELEMENTE.map(kopiereElement)
  };
}
