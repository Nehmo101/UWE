/* Finale Waldsaeule-A-Runde fuer die 51er-Requisitengalerie. */
import * as THREE from 'three';
import { M, mergeGeos, part } from './geometrie-hilfen.js';

export const REQUISITEN_FINAL_POOLS = Object.freeze([
  'bank', 'bildstock', 'brunnen', 'brunnentrog', 'dreimaster',
  'faerbergestell', 'fass', 'fensterlicht', 'feuerschale', 'feuerstelle',
  'findling', 'fischtrockner', 'gaube', 'gebetsband', 'geweihgestell',
  'gewoelbekeller', 'hochschlot', 'holzstapel', 'huetersaeule', 'irrlicht',
  'kalkofen', 'kamin', 'karren', 'kiste', 'kochkessel', 'koehlermeiler',
  'kran', 'kutsche', 'laterne', 'marktkorb', 'marktstand', 'moewe',
  'oasenbecken', 'pfahlgoetze', 'rosette', 'sackstapel', 'saegewerk',
  'saeule', 'schlitten', 'schubkarre', 'seilerbahn', 'steinmetzhof',
  'sturzwurzel', 'tisch', 'tontoepfe', 'waescheleine', 'wagenrad',
  'wappenstein', 'wasserbottich', 'windfaenger', 'zwergentor'
]);

const AUDIT = new Set(REQUISITEN_FINAL_POOLS);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const IC0 = new THREE.IcosahedronGeometry(0.5, 0);
const IC1 = new THREE.IcosahedronGeometry(0.5, 1);
const CY6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false);
const CY8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, false);
const CONE6 = new THREE.ConeGeometry(0.5, 1, 6, 1, false);
const TORUS = new THREE.TorusGeometry(0.5, 0.08, 5, 14);
const Y = new THREE.Vector3(0, 1, 0);
const PI = Math.PI;

function box(p, x, y, z, sx, sy, sz, color, rx, ry, rz) {
  p.push(part(BOX, M(x, y, z, rx, ry, rz, sx, sy, sz), color));
}

function ball(p, x, y, z, sx, sy, sz, color, detail) {
  p.push(part(detail ? IC1 : IC0, M(x, y, z, 0, 0, 0, sx, sy, sz), color));
}

function cone(p, x, y, z, sx, sy, sz, color, rx, ry, rz) {
  p.push(part(CONE6, M(x, y, z, rx, ry, rz, sx, sy, sz), color));
}

function segment(p, ax, ay, az, bx, by, bz, radius, color, eight) {
  const a = new THREE.Vector3(ax, ay, az);
  const b = new THREE.Vector3(bx, by, bz);
  const direction = b.clone().sub(a);
  const length = direction.length();
  if (length < 1e-6) return;
  const matrix = new THREE.Matrix4();
  matrix.compose(a.add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(Y, direction.normalize()),
    new THREE.Vector3(radius * 2, length, radius * 2));
  p.push(part(eight ? CY8 : CY6, matrix, color));
}

function face(p, points, color) {
  const positions = [];
  for (let i = 1; i < points.length - 1; i++) {
    positions.push(...points[0], ...points[i], ...points[i + 1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  p.push(part(geometry, null, color));
}

function laterne() {
  const p = [];
  ball(p, 0, 0.09, 0, 0.46, 0.18, 0.42, 0x6e6657);
  box(p, 0, 0.2, 0, 0.42, 0.18, 0.36, 0x4b4540);
  segment(p, 0, 0.25, 0, 0, 1.7, 0, 0.075, 0x343b37, true);
  segment(p, 0, 1.58, 0, 0.42, 1.78, 0, 0.06, 0x343b37, true);
  segment(p, 0.42, 1.78, 0, 0.42, 1.62, 0, 0.045, 0x343b37);
  for (const s of [-1, 1]) {
    segment(p, 0.42 + s * 0.19, 1.25, -0.16,
      0.42 + s * 0.19, 1.71, -0.16, 0.025, 0x4b514c);
    segment(p, 0.42 + s * 0.19, 1.25, 0.16,
      0.42 + s * 0.19, 1.71, 0.16, 0.025, 0x4b514c);
  }
  cone(p, 0.42, 1.82, 0, 0.56, 0.3, 0.5, 0x3e4541);
  ball(p, 0.42, 1.49, 0.01, 0.16, 0.25, 0.14, 0xf2b956, 1);
  return p;
}

function dreimaster() {
  const p = [];
  const wood = 0x765238, dark = 0x493a31, sail = 0xeee5c9, red = 0xb95f48;
  ball(p, 0, 0.58, 0, 1.35, 0.72, 2.75, wood, 1);
  box(p, 0, 0.9, 0, 1.55, 0.18, 3.3, 0xa57a48);
  box(p, 0, 1.15, -1.2, 1.25, 0.48, 0.8, dark);
  cone(p, 0, 0.72, 2.1, 1.15, 0.9, 1.45, wood, PI / 2, 0, 0);
  const masts = [[-0.7, 3.55], [0, 4.35], [0.78, 3.45]];
  for (let i = 0; i < masts.length; i++) {
    const z = masts[i][0], top = masts[i][1];
    segment(p, 0, 1.0, z, 0, top, z, 0.07, dark, true);
    segment(p, -0.72, top - 0.8, z, 0.72, top - 0.8, z, 0.045, dark);
    face(p, [[0.03, top - 0.1, z], [0.03, top - 1.45, z],
      [0.68, top - 1.35, z], [0.68, top - 0.2, z]], i === 1 ? red : sail);
    face(p, [[-0.03, top - 0.25, z], [-0.03, top - 1.5, z],
      [-0.62, top - 1.35, z]], sail);
  }
  segment(p, 0, 3.9, 0, 0, 1.12, 2.4, 0.018, 0x8a765c);
  segment(p, 0, 3.9, 0, 0, 1.12, -1.7, 0.018, 0x8a765c);
  segment(p, -0.92, 1.05, 0, -0.92, 1.05, -1.55, 0.045, dark);
  segment(p, 0.92, 1.05, 0, 0.92, 1.05, -1.55, 0.045, dark);
  for (let i = -1; i <= 1; i++) {
    ball(p, 0.86, 0.78, -0.45 + i * 0.48, 0.09, 0.09, 0.05, 0xe0b45d, 1);
  }
  return p;
}

function marktstand() {
  const p = [];
  const wood = 0x765136, light = 0xa87a4b, cloth = 0xc96d58, cream = 0xe3c987;
  for (const x of [-0.95, 0.95]) for (const z of [-0.52, 0.52]) {
    segment(p, x, 0.05, z, x, 2.0, z, 0.075, wood, true);
  }
  box(p, 0, 0.78, 0, 2.15, 0.22, 1.3, light);
  box(p, 0, 0.48, 0.22, 2.05, 0.5, 0.75, wood);
  box(p, -0.57, 2.14, 0, 1.3, 0.08, 1.55, cloth, 0, 0, -0.4);
  box(p, 0.57, 2.14, 0, 1.3, 0.08, 1.55, cream, 0, 0, 0.4);
  for (let i = 0; i < 7; i++) {
    const x = -0.78 + i * 0.26;
    ball(p, x, 0.98 + (i % 2) * 0.04, -0.18 + (i % 3) * 0.18,
      0.2, 0.2, 0.2, [0xd58a48, 0xe1c35f, 0x78935c][i % 3]);
  }
  for (let i = 0; i < 6; i++) {
    cone(p, -0.9 + i * 0.36, 1.82, 0.74, 0.12, 0.32, 0.08,
      i % 2 ? cream : cloth, PI, 0, 0);
  }
  return p;
}

function schubkarre() {
  const p = [];
  const wood = 0x8a633e, dark = 0x594331;
  face(p, [[-0.62, 0.55, -0.55], [0.62, 0.55, -0.55], [0.45, 0.42, 0.55],
    [-0.45, 0.42, 0.55]], wood);
  face(p, [[-0.62, 0.55, -0.55], [-0.45, 0.42, 0.55], [-0.25, 0.85, 0.45],
    [-0.38, 0.95, -0.48]], 0xa98050);
  face(p, [[0.62, 0.55, -0.55], [0.38, 0.95, -0.48], [0.25, 0.85, 0.45],
    [0.45, 0.42, 0.55]], 0x9a7247);
  for (const s of [-1, 1]) {
  face(p, [[-0.62, 0.55, -0.55], [-0.38, 0.95, -0.48],
    [0.38, 0.95, -0.48], [0.62, 0.55, -0.55]], wood);
  face(p, [[-0.45, 0.42, 0.55], [0.45, 0.42, 0.55],
    [0.25, 0.85, 0.45], [-0.25, 0.85, 0.45]], 0x9f774a);
    segment(p, s * 0.38, 0.55, 0.45, s * 0.52, 0.58, -1.42, 0.055, dark);
    segment(p, s * 0.28, 0.5, -0.2, s * 0.28, 0.05, -0.58, 0.045, dark);
  }
  p.push(part(TORUS, M(0, 0.42, 0.72, 0, PI / 2, 0, 0.72, 0.72, 0.72), dark));
  segment(p, -0.38, 0.42, 0.72, 0.38, 0.42, 0.72, 0.04, wood);
  ball(p, 0, 0.7, 0.02, 0.42, 0.18, 0.4, 0x67543d, 1);
  return p;
}

function marktkorb() {
  const p = [];
  const wicker = 0xb48850, dark = 0x725236;
  p.push(part(new THREE.CylinderGeometry(0.42, 0.32, 0.55, 10, 1, false),
    M(0, 0.3, 0), wicker));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2;
    segment(p, Math.cos(a) * 0.34, 0.08, Math.sin(a) * 0.34,
      Math.cos(a) * 0.44, 0.58, Math.sin(a) * 0.44, 0.018, dark);
  }
  let previous = [-0.42, 0.52, 0];
  for (let i = 1; i <= 6; i++) {
    const a = PI - i / 6 * PI;
    const next = [Math.cos(a) * 0.42, 0.52 + Math.sin(a) * 0.62, 0];
    segment(p, ...previous, ...next, 0.035, dark);
    previous = next;
  }
  const produce = [[-0.2, 0.63, 0, 0xd77b45], [0.12, 0.68, -0.12, 0xe0bd56],
    [0.2, 0.62, 0.12, 0x739258], [-0.04, 0.78, 0.08, 0xc9624f]];
  for (const item of produce) {
    ball(p, item[0], item[1], item[2], 0.24, 0.22, 0.24, item[3]);
  }
  return p;
}

function zwergentor() {
  const p = [];
  const stone = 0x716b5d, light = 0xa99d82, dark = 0x343a35, gold = 0xd3aa4d;
  box(p, -1.55, 1.8, 0, 1.25, 3.6, 1.5, stone);
  box(p, 1.55, 1.8, 0, 1.25, 3.6, 1.5, stone);
  box(p, 0, 3.65, 0, 4.35, 0.75, 1.7, stone);
  for (const s of [-1, 1]) {
    box(p, s * 2.05, 0.42, 0.18, 0.72, 0.84, 1.8, light, 0, s * 0.08, 0);
    box(p, s * 1.45, 2.1, 0.78, 0.32, 0.32, 0.08, gold);
  }
  for (let i = -2; i <= 2; i++) {
    segment(p, i * 0.28, 0.18, 0.52, i * 0.28, 3.28, 0.52, 0.055, dark, true);
  }
  for (let i = 0; i < 4; i++) {
    box(p, 0, 0.55 + i * 0.7, 0.54, 1.6, 0.12, 0.1, gold);
  }
  box(p, 0, 3.62, 0.88, 0.75, 0.42, 0.1, gold);
  cone(p, 0, 4.45, 0, 0.82, 1.15, 0.75, light);
  for (const s of [-1, 1]) {
    segment(p, s * 0.75, 3.72, 0.62, s * 0.75, 4.12, 0.62, 0.035, gold);
    ball(p, s * 0.75, 4.16, 0.62, 0.13, 0.13, 0.13, 0xf0bd63, 1);
  }
  return p;
}

const BUILDERS = Object.freeze({
  laterne, dreimaster, marktstand, schubkarre, marktkorb, zwergentor
});

export function veredleRequisitenFinal(name, geometry) {
  if (!AUDIT.has(name)) return geometry;
  const builder = BUILDERS[name];
  const parts = builder ? builder() : null;
  const result = parts ? mergeGeos(parts) : geometry;
  if (parts) Object.assign(result.userData, geometry.userData);
  result.userData.requisitenFinalFormensprache = 'waldsaeule-a';
  result.userData.requisitenFinalAudit = true;
  result.userData.requisitenFinalNeuaufbau = !!parts;
  result.userData.requisitenFinalDetails = parts ? parts.length : 0;
  return result;
}
