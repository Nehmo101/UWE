/**
 * Aufnahmekatalog fuer die visuelle Abnahme von terra.
 *
 * Jede Aufnahme ist ein fester Blick auf eine Bilddomaene (Gelaende, Wasser,
 * Bewuchs, Architektur, Himmel, Licht, Effekte). Die Kamera wird NICHT mit
 * festen Weltkoordinaten gesetzt, sondern in der Seite aus den erzeugten
 * Elementen gerechnet: verschiebt eine Aenderung die Beispielkarte, zeigt die
 * Aufnahme weiterhin dasselbe Motiv statt auf leere Wiese zu blicken.
 *
 * `rahmen` laeuft IM Browser (page.evaluate) und bekommt `__terraShot`.
 */

/** Schwerpunkt der Punkte eines Elements. */
const SCHWERPUNKT = `function(e){
  var x=0,z=0; for (var i=0;i<e.points.length;i++){ x+=e.points[i].x; z+=e.points[i].z; }
  return { x: x/e.points.length, z: z/e.points.length };
}`;

/** Erstes Element einer Art/Variante. */
const FINDE = `function(S,kind,variant){
  for (var i=0;i<S.elements.length;i++){
    var e=S.elements[i];
    if (e.kind===kind && (!variant || e.variant===variant)) return e;
  }
  return null;
}`;

const HILFEN = `var schwerpunkt=${SCHWERPUNKT}; var finde=${FINDE};`;

export const SHOTS = [
  {
    id: "weite-morgen",
    bereich: "licht",
    titel: "Weite Landschaft · Morgen",
    frage: "Traegt die Gesamtkomposition? Tiefenstaffelung, Silhouetten, Farbklima.",
    tod: "morgen",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'flaeche','viertel');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x-24,z:c.z-20,dist:168,pitch:0.56,yaw:0.85,fov:34});`
  },
  {
    id: "weite-abend",
    bereich: "licht",
    titel: "Weite Landschaft · Abendrot",
    frage: "Traegt das warme Gegenlicht? Wolkenrand, Schattenfarbe, Himmelsverlauf.",
    tod: "abend",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'flaeche','viertel');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x-24,z:c.z-20,dist:168,pitch:0.40,yaw:0.85,fov:34});`
  },
  {
    id: "weite-nacht",
    bereich: "licht",
    titel: "Weite Landschaft · Nacht",
    frage: "Lesbarkeit bei Nacht: Sterne, Mond, Fensterglut, leuchtende Ranken.",
    tod: "nacht",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'flaeche','viertel');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x-24,z:c.z-20,dist:168,pitch:0.46,yaw:0.85,fov:34});`
  },
  {
    id: "weite-nebel",
    bereich: "atmosphaere",
    titel: "Weite Landschaft · Nebel",
    frage: "Luftperspektive: Tiefenstaffelung, weiche Kanten, keine graue Suppe.",
    tod: "nebel",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'flaeche','viertel');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x-24,z:c.z-20,dist:168,pitch:0.46,yaw:0.85,fov:34});`
  },
  {
    id: "stadt-nah",
    bereich: "architektur",
    titel: "Siedlung · Nahblick",
    frage: "Daecher, Fassaden, Gassen: Materialwirkung und Silhouette aus Augenhoehe.",
    tod: "morgen",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'flaeche','viertel');
      var c=t?schwerpunkt(t):{x:20,z:20};
      __terraShot.stelle({x:c.x,z:c.z,dist:54,pitch:0.34,yaw:1.05,fov:32});`
  },
  {
    id: "wald-nah",
    bereich: "bewuchs",
    titel: "Wald · Nahblick",
    frage: "Kronenform, Blattmasse, Windbewegung, Uebergang Wald/Wiese.",
    tod: "morgen",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'flaeche','wald');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x,z:c.z,dist:46,pitch:0.28,yaw:0.62,fov:32});`
  },
  {
    id: "wasser-kueste",
    bereich: "wasser",
    titel: "Kueste · Wasserkante",
    frage: "Wasserfarbe, Schaumsaum, Spiegelung, Uebergang Land/Wasser.",
    biom: "kueste",
    tod: "mittag",
    rahmen: `__terraShot.stelle({x:0,z:0,dist:150,pitch:0.24,yaw:0.85,fov:34});`
  },
  {
    id: "ranke-plateau",
    bereich: "held",
    titel: "Ranke mit Blattstadt · Held",
    frage: "Monumentale Silhouette gegen den Himmel, Massstab, Stadt auf dem Plateau.",
    tod: "abend",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'ranke');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x,z:c.z,dist:230,pitch:0.10,yaw:0.9,fov:36,hebung:96});`
  },
  {
    id: "schildkroete",
    bereich: "held",
    titel: "Weltschildkroete · Held",
    frage: "Hero-Asset aus der Naehe: Panzerform, Materialwirkung, Bewegung.",
    tod: "morgen",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'objekt','weltschildkroete');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x,z:c.z,dist:44,pitch:0.18,yaw:0.7,fov:30,hebung:6});`
  },
  {
    id: "berg-schnee",
    bereich: "gelaende",
    titel: "Hochgebirge · Schnee",
    frage: "Gelaendeform, Schneeauflage, Felsstruktur, Silhouette der Grate.",
    biom: "schnee",
    tod: "mittag",
    rahmen: `__terraShot.stelle({x:0,z:0,dist:190,pitch:0.30,yaw:0.5,fov:34});`
  },
  {
    id: "wetter-regen",
    bereich: "effekte",
    titel: "Regen · Wetterlage",
    frage: "Niederschlag, Wolkendecke, Windwirkung, nasse Stimmung.",
    tod: "mittag",
    wetter: "regen",
    rahmen: `${HILFEN}
      var t=finde(__terraShot.S,'flaeche','viertel');
      var c=t?schwerpunkt(t):{x:0,z:0};
      __terraShot.stelle({x:c.x-16,z:c.z-14,dist:120,pitch:0.34,yaw:0.85,fov:34});`
  },
  {
    id: "luft-archipel",
    bereich: "luft",
    titel: "Luftarchipel · Schwebeinseln",
    frage: "Schwebende Inseln, Flugrouten, Wolkenmeer, Tiefenwirkung nach unten.",
    url: "?schau=luft",
    rahmen: null
  },
  {
    id: "architektur-schau",
    bereich: "architektur",
    titel: "Architektur-Schaukasten",
    frage: "Alle Baustile nebeneinander: Formensprache, Materialtreue, Ablesbarkeit.",
    url: "?schau=architektur",
    rahmen: null
  },
  {
    id: "kartenmodus",
    bereich: "karte",
    titel: "Kartenmodus · gezeichnete Chronikkarte",
    frage: "Gezeichnete Karte: Linienfuehrung, Signaturen, Papier, Beschriftung.",
    url: "?karte=1",
    bedienung: true,
    warteMs: 2600,
    rahmen: null
  }
];

export const BEREICHE = [...new Set(SHOTS.map((s) => s.bereich))];

export function shotsFuer(auswahl) {
  if (!auswahl || auswahl === "alle") return SHOTS;
  const wunsch = new Set(auswahl.split(",").map((s) => s.trim()).filter(Boolean));
  return SHOTS.filter((s) => wunsch.has(s.id) || wunsch.has(s.bereich));
}
