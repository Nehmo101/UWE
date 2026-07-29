import * as THREE from "three";

/** Transformationsmatrix aus Position, Euler-Rotation und Skalierung. */
export function M(x, y, z, rx, ry, rz, sx, sy, sz) {
  var matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(x || 0, y || 0, z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(
      sx === undefined ? 1 : sx,
      sy === undefined ? 1 : sy,
      sz === undefined ? 1 : sz
    )
  );
  return matrix;
}

function weissesFarbattribut(anzahl) {
  var farben = new Float32Array(anzahl * 3);
  farben.fill(1);
  return new THREE.BufferAttribute(farben, 3);
}

/**
 * Ergänzt den Terra-Vertrag position/normal/color/uv. Das ist absichtlich
 * zentral: auch Three-Primitiven besitzen nicht in jeder Version dieselben
 * optionalen Attribute.
 */
export function vollstaendigeAttribute(geometrie) {
  if (!geometrie || !geometrie.attributes || !geometrie.attributes.position) {
    throw new Error("Geometrie ohne position-Attribut");
  }
  var anzahl = geometrie.attributes.position.count;
  if (!geometrie.attributes.normal || geometrie.attributes.normal.count !== anzahl) {
    geometrie.computeVertexNormals();
  }
  if (!geometrie.attributes.color || geometrie.attributes.color.count !== anzahl) {
    geometrie.setAttribute("color", weissesFarbattribut(anzahl));
  }
  if (!geometrie.attributes.uv || geometrie.attributes.uv.count !== anzahl) {
    geometrie.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(anzahl * 2), 2));
  }
  return geometrie;
}

/** Färbt und transformiert eine geklonte Three-Geometrie. */
export function part(geometrie, matrix, hex) {
  var teil = geometrie.clone();
  if (matrix) teil.applyMatrix4(matrix);
  vollstaendigeAttribute(teil);
  var farbe = new THREE.Color(hex === undefined ? 0xffffff : hex);
  var farben = new Float32Array(teil.attributes.position.count * 3);
  for (var i = 0; i < teil.attributes.position.count; i++) {
    farben[i * 3] = farbe.r;
    farben[i * 3 + 1] = farbe.g;
    farben[i * 3 + 2] = farbe.b;
  }
  teil.setAttribute("color", new THREE.BufferAttribute(farben, 3));
  return teil;
}

/**
 * Sicherheitsnetz für entartete Normalen. Verwendete Nullnormalen würden im
 * Streiflicht schwarz; die Ersatzrichtung zeigt vom Schwerpunkt nach außen.
 */
export function normalenRetten(geometrie) {
  vollstaendigeAttribute(geometrie);
  var position = geometrie.attributes.position.array;
  var normalen = geometrie.attributes.normal.array;
  var anzahl = geometrie.attributes.position.count;
  var benutzt = new Uint8Array(anzahl);
  var i;
  if (geometrie.index) {
    for (i = 0; i < geometrie.index.array.length; i++) benutzt[geometrie.index.array[i]] = 1;
  } else {
    benutzt.fill(1);
  }
  var cx = 0, cy = 0, cz = 0, n = 0;
  for (i = 0; i < anzahl; i++) {
    if (!benutzt[i]) continue;
    cx += position[i * 3];
    cy += position[i * 3 + 1];
    cz += position[i * 3 + 2];
    n++;
  }
  if (!n) return 0;
  cx /= n; cy /= n; cz /= n;
  var repariert = 0;
  for (i = 0; i < anzahl; i++) {
    if (!benutzt[i]) continue;
    var nx = normalen[i * 3], ny = normalen[i * 3 + 1], nz = normalen[i * 3 + 2];
    if (nx * nx + ny * ny + nz * nz >= 1e-12) continue;
    var dx = position[i * 3] - cx;
    var dy = position[i * 3 + 1] - cy;
    var dz = position[i * 3 + 2] - cz;
    var laenge = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (laenge < 1e-6) {
      normalen[i * 3] = 0;
      normalen[i * 3 + 1] = 1;
      normalen[i * 3 + 2] = 0;
    } else {
      normalen[i * 3] = dx / laenge;
      normalen[i * 3 + 1] = dy / laenge;
      normalen[i * 3 + 2] = dz / laenge;
    }
    repariert++;
  }
  geometrie.attributes.normal.needsUpdate = repariert > 0;
  return repariert;
}

/**
 * Führt indizierte und nicht indizierte Teile zusammen. Fehlende optionale
 * Attribute werden vor dem Kopieren ergänzt; das Ergebnis hält damit immer
 * den vollständigen Terra-Poolvertrag.
 */
export function mergeGeos(liste) {
  var teile = (liste || []).filter(Boolean).map(function (geometrie) {
    return vollstaendigeAttribute(geometrie.clone());
  });
  if (!teile.length) throw new Error("mergeGeos braucht mindestens eine Geometrie");

  var vertexGesamt = 0, indexGesamt = 0, i, j;
  for (i = 0; i < teile.length; i++) {
    vertexGesamt += teile[i].attributes.position.count;
    indexGesamt += teile[i].index
      ? teile[i].index.count
      : teile[i].attributes.position.count;
  }

  var position = new Float32Array(vertexGesamt * 3);
  var normalen = new Float32Array(vertexGesamt * 3);
  var farben = new Float32Array(vertexGesamt * 3);
  var uv = new Float32Array(vertexGesamt * 2);
  var IndexArray = vertexGesamt > 65535 ? Uint32Array : Uint16Array;
  var indices = new IndexArray(indexGesamt);
  var vertexOffset = 0, indexOffset = 0;

  for (i = 0; i < teile.length; i++) {
    var teil = teile[i];
    var count = teil.attributes.position.count;
    position.set(teil.attributes.position.array.subarray(0, count * 3), vertexOffset * 3);
    normalen.set(teil.attributes.normal.array.subarray(0, count * 3), vertexOffset * 3);
    farben.set(teil.attributes.color.array.subarray(0, count * 3), vertexOffset * 3);
    uv.set(teil.attributes.uv.array.subarray(0, count * 2), vertexOffset * 2);
    if (teil.index) {
      for (j = 0; j < teil.index.array.length; j++) {
        indices[indexOffset++] = teil.index.array[j] + vertexOffset;
      }
    } else {
      for (j = 0; j < count; j++) indices[indexOffset++] = vertexOffset + j;
    }
    vertexOffset += count;
  }

  var ergebnis = new THREE.BufferGeometry();
  ergebnis.setAttribute("position", new THREE.BufferAttribute(position, 3));
  ergebnis.setAttribute("normal", new THREE.BufferAttribute(normalen, 3));
  ergebnis.setAttribute("color", new THREE.BufferAttribute(farben, 3));
  ergebnis.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  ergebnis.setIndex(new THREE.BufferAttribute(indices, 1));
  normalenRetten(ergebnis);
  ergebnis.computeBoundingBox();
  ergebnis.computeBoundingSphere();
  return ergebnis;
}

/**
 * Giebeldach als Dreiecksprisma, Firstrichtung z. Der Helfer bleibt für
 * organische Sonderbauten verfügbar; die Architekturserie selbst verwendet
 * ausschließlich Three-Primitiven.
 */
export function prismGeo(breite, hoehe, tiefe) {
  var x = breite / 2, z = tiefe / 2;
  var A = [-x, 0, -z], B = [x, 0, -z], C = [0, hoehe, -z];
  var D = [-x, 0, z], E = [x, 0, z], F = [0, hoehe, z];
  var dreiecke = [
    A, C, B, D, E, F,
    A, D, F, A, F, C,
    B, C, F, B, F, E,
    A, B, E, A, E, D
  ];
  var position = new Float32Array(dreiecke.length * 3);
  var uv = new Float32Array(dreiecke.length * 2);
  for (var i = 0; i < dreiecke.length; i++) {
    position[i * 3] = dreiecke[i][0];
    position[i * 3 + 1] = dreiecke[i][1];
    position[i * 3 + 2] = dreiecke[i][2];
    uv[i * 2] = i % 3 === 1 ? 0.5 : (i % 3 === 2 ? 1 : 0);
    uv[i * 2 + 1] = i % 3 === 1 ? 1 : 0;
  }
  var geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometrie.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometrie.computeVertexNormals();
  return vollstaendigeAttribute(geometrie);
}

/** Deterministische Helligkeitsvariation eines Hex-Farbwerts. */
export function farbton(hex, faktor) {
  var r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * faktor)));
  var g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * faktor)));
  var b = Math.max(0, Math.min(255, Math.round((hex & 255) * faktor)));
  return (r << 16) | (g << 8) | b;
}
