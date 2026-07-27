/* ==========================================================================
   Three-Ersatz fuer die Tests (steht fuer three 0.185.1, siehe terra/index.html)

   Warum ueberhaupt: terra laedt Three ueber eine Import-Map vom CDN. In Node
   gibt es weder Import-Map noch node_modules — der Bezeichner 'three' waere
   unaufloesbar, und schon `import { S } from core/store.js` scheiterte. Der
   Loader-Haken (haken.mjs) leitet 'three' deshalb hierher um.

   Was dieser Ersatz IST: eine eigenstaendige, deterministische Nachbildung der
   Teilmenge, die terra ausserhalb des Browsers wirklich benutzt — Vektor-/
   Matrix-/Farbmathematik, BufferGeometry samt Primitiven, Objekthierarchie,
   InstancedMesh. Die Primitiven erzeugen ECHTE Vertexdaten (position, normal,
   uv, index) nach denselben Formeln wie Three; nur so haben Aussagen wie
   „kein NaN in Position/Normale/UV" oder „Dreieckszahl je Pool" Gewicht.

   Was er NICHT ist: eine Rendering-Implementierung. WebGL, Shaderchunks,
   Texturen und Postprocessing sind leere Huellen. Die Shader-Anker werden
   deshalb NICHT gegen diesen Ersatz geprueft, sondern gegen die gepinnte
   Three-Quelle (siehe 04-shader-anker.test.mjs und hilfen/three-quelle.mjs).

   Bekannte, bewusste Abweichungen (in der README dokumentiert):
     - IcosahedronGeometry: Unterteilung und Radius stimmen, die UV-Naht wird
       nicht korrigiert (Three's correctUV). UVs bleiben endlich und in 0..1.
     - Kein Morph/Skinning, keine Gruppen-Materialien, kein Raycasting.
   ========================================================================== */

/* --- Konstanten ---------------------------------------------------------- */
export const FrontSide = 0, BackSide = 1, DoubleSide = 2;
export const NoBlending = 0, NormalBlending = 1, AdditiveBlending = 2;
export const StaticDrawUsage = 35044, DynamicDrawUsage = 35048;
export const NoColorSpace = '', SRGBColorSpace = 'srgb', LinearSRGBColorSpace = 'srgb-linear';
export const RepeatWrapping = 1000, ClampToEdgeWrapping = 1001, MirroredRepeatWrapping = 1002;
export const NearestFilter = 1003, LinearFilter = 1006;
export const NearestMipmapLinearFilter = 1005, LinearMipmapLinearFilter = 1008;
export const UnsignedByteType = 1009, ByteType = 1010, FloatType = 1015, HalfFloatType = 1016;
export const UnsignedIntType = 1014, UnsignedShortType = 1012, UnsignedInt248Type = 1020;
export const AlphaFormat = 1021, RGBAFormat = 1023, RedFormat = 1028, RGFormat = 1030;
export const DepthFormat = 1026, DepthStencilFormat = 1027;
export const NoToneMapping = 0, LinearToneMapping = 1, ACESFilmicToneMapping = 4;
export const PCFSoftShadowMap = 2;
export const REVISION = '185';

/* --- Farbverwaltung ------------------------------------------------------
   Three r152+ rechnet Hex-Werte beim Setzen von sRGB in den linearen
   Arbeitsraum um; setRGB() tut das NICHT. terra setzt Palettenfarben als Hex
   und Vertexfarben ueber setRGB — die Unterscheidung muss stimmen, sonst
   waeren alle gehashten Farbwerte gegenueber dem Browser verschoben. */
function srgbZuLinear(c) {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
function linearZuSrgb(c) {
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
export const ColorManagement = { enabled: true, workingColorSpace: LinearSRGBColorSpace };

/* --- Vector2 ------------------------------------------------------------- */
export class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
  clone() { return new Vector2(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; return this; }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  distanceTo(v) { const dx = this.x - v.x, dy = this.y - v.y; return Math.sqrt(dx * dx + dy * dy); }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; return this; }
  equals(v) { return v.x === this.x && v.y === this.y; }
}

/* --- Vector3 ------------------------------------------------------------- */
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; if (z !== undefined) this.z = z; return this; }
  setScalar(s) { this.x = this.y = this.z = s; return this; }
  setX(v) { this.x = v; return this; }
  setY(v) { this.y = v; return this; }
  setZ(v) { this.z = v; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScalar(s) { this.x += s; this.y += s; this.z += s; return this; }
  addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  multiply(v) { this.x *= v.x; this.y *= v.y; this.z *= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  divideScalar(s) { return this.multiplyScalar(1 / s); }
  negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  setLength(l) { return this.normalize().multiplyScalar(l); }
  lerp(v, t) {
    this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t;
    return this;
  }
  lerpVectors(a, b, t) {
    this.x = a.x + (b.x - a.x) * t; this.y = a.y + (b.y - a.y) * t; this.z = a.z + (b.z - a.z) * t;
    return this;
  }
  cross(v) { return this.crossVectors(this, v); }
  crossVectors(a, b) {
    const ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
  distanceTo(v) { return Math.sqrt(this.distanceToSquared(v)); }
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  min(v) { this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); this.z = Math.min(this.z, v.z); return this; }
  max(v) { this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); this.z = Math.max(this.z, v.z); return this; }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z, e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  applyMatrix3(m) {
    const x = this.x, y = this.y, z = this.z, e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6] * z;
    this.y = e[1] * x + e[4] * y + e[7] * z;
    this.z = e[2] * x + e[5] * y + e[8] * z;
    return this;
  }
  applyNormalMatrix(m) { return this.applyMatrix3(m).normalize(); }
  transformDirection(m) {
    const x = this.x, y = this.y, z = this.z, e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  }
  applyQuaternion(q) {
    const vx = this.x, vy = this.y, vz = this.z, qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;
    return this;
  }
  applyAxisAngle(axis, winkel) { return this.applyQuaternion(_q1.setFromAxisAngle(axis, winkel)); }
  setFromMatrixPosition(m) {
    const e = m.elements; this.x = e[12]; this.y = e[13]; this.z = e[14]; return this;
  }
  setFromMatrixColumn(m, i) { return this.fromArray(m.elements, i * 4); }
  fromArray(a, o = 0) { this.x = a[o]; this.y = a[o + 1]; this.z = a[o + 2]; return this; }
  toArray(a = [], o = 0) { a[o] = this.x; a[o + 1] = this.y; a[o + 2] = this.z; return a; }
  fromBufferAttribute(attr, i) {
    this.x = attr.getX(i); this.y = attr.getY(i); this.z = attr.getZ(i); return this;
  }
  angleTo(v) {
    const d = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (d === 0) return Math.PI / 2;
    return Math.acos(Math.max(-1, Math.min(1, this.dot(v) / d)));
  }
  equals(v) { return v.x === this.x && v.y === this.y && v.z === this.z; }
  project() { return this; }        // ohne Kamera bedeutungslos, nur Formsache
  unproject() { return this; }
}

/* --- Vector4 ------------------------------------------------------------- */
export class Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; this.w = v.w === undefined ? 1 : v.w; return this; }
  clone() { return new Vector4(this.x, this.y, this.z, this.w); }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; this.w *= s; return this; }
}

/* --- Color --------------------------------------------------------------- */
export class Color {
  constructor(r, g, b) { this.r = 1; this.g = 1; this.b = 1; if (r !== undefined) this.set(r, g, b); }
  set(r, g, b) {
    if (g === undefined && b === undefined) {
      if (r instanceof Color) return this.copy(r);
      if (typeof r === 'number') return this.setHex(r);
      if (typeof r === 'string') return this.setStyle(r);
      return this;
    }
    return this.setRGB(r, g, b);
  }
  setHex(hex, colorSpace = SRGBColorSpace) {
    hex = Math.floor(hex);
    let r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
    if (ColorManagement.enabled && colorSpace === SRGBColorSpace) {
      r = srgbZuLinear(r); g = srgbZuLinear(g); b = srgbZuLinear(b);
    }
    this.r = r; this.g = g; this.b = b;
    return this;
  }
  setStyle(s) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(s).trim());
    return m ? this.setHex(parseInt(m[1], 16)) : this;
  }
  setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  setScalar(v) { this.r = this.g = this.b = v; return this; }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
  clone() { return new Color(0).setRGB(this.r, this.g, this.b); }
  add(c) { this.r += c.r; this.g += c.g; this.b += c.b; return this; }
  multiply(c) { this.r *= c.r; this.g *= c.g; this.b *= c.b; return this; }
  multiplyScalar(s) { this.r *= s; this.g *= s; this.b *= s; return this; }
  lerp(c, t) {
    this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t;
    return this;
  }
  getHex(colorSpace = SRGBColorSpace) {
    let r = this.r, g = this.g, b = this.b;
    if (ColorManagement.enabled && colorSpace === SRGBColorSpace) {
      r = linearZuSrgb(r); g = linearZuSrgb(g); b = linearZuSrgb(b);
    }
    const k = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    return (k(r) << 16) | (k(g) << 8) | k(b);
  }
  getHexString(cs) { return ('000000' + this.getHex(cs).toString(16)).slice(-6); }
  convertSRGBToLinear() {
    this.r = srgbZuLinear(this.r); this.g = srgbZuLinear(this.g); this.b = srgbZuLinear(this.b);
    return this;
  }
  convertLinearToSRGB() {
    this.r = linearZuSrgb(this.r); this.g = linearZuSrgb(this.g); this.b = linearZuSrgb(this.b);
    return this;
  }
  equals(c) { return c.r === this.r && c.g === this.g && c.b === this.b; }
  toArray(a = [], o = 0) { a[o] = this.r; a[o + 1] = this.g; a[o + 2] = this.b; return a; }
}

/* --- Euler / Quaternion -------------------------------------------------- */
export class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
    this._x = x; this._y = y; this._z = z; this._order = order; this._cb = null;
  }
  get x() { return this._x; } set x(v) { this._x = v; this._melde(); }
  get y() { return this._y; } set y(v) { this._y = v; this._melde(); }
  get z() { return this._z; } set z(v) { this._z = v; this._melde(); }
  get order() { return this._order; } set order(v) { this._order = v; this._melde(); }
  _melde() { if (this._cb) this._cb(); }
  _onChange(cb) { this._cb = cb; return this; }
  set(x, y, z, order) {
    this._x = x; this._y = y; this._z = z; if (order) this._order = order;
    this._melde(); return this;
  }
  copy(e) { this._x = e._x; this._y = e._y; this._z = e._z; this._order = e._order; this._melde(); return this; }
  clone() { return new Euler(this._x, this._y, this._z, this._order); }
  setFromQuaternion(q, order) {
    _m1.makeRotationFromQuaternion(q);
    return this.setFromRotationMatrix(_m1, order || this._order);
  }
  setFromRotationMatrix(m, order = this._order) {
    const te = m.elements, k = (v) => Math.max(-1, Math.min(1, v));
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    if (order === 'YXZ') {
      this._x = Math.asin(-k(m23));
      if (Math.abs(m23) < 0.9999999) {
        this._y = Math.atan2(m13, m33); this._z = Math.atan2(m21, m22);
      } else { this._y = Math.atan2(-m31, m11); this._z = 0; }
    } else {                                   // XYZ
      this._y = Math.asin(k(m13));
      if (Math.abs(m13) < 0.9999999) {
        this._x = Math.atan2(-m23, m33); this._z = Math.atan2(-m12, m11);
      } else { this._x = Math.atan2(m32, m22); this._z = 0; }
    }
    this._order = order; this._melde();
    return this;
  }
}

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this._x = x; this._y = y; this._z = z; this._w = w; this._cb = null; }
  get x() { return this._x; } set x(v) { this._x = v; this._melde(); }
  get y() { return this._y; } set y(v) { this._y = v; this._melde(); }
  get z() { return this._z; } set z(v) { this._z = v; this._melde(); }
  get w() { return this._w; } set w(v) { this._w = v; this._melde(); }
  _melde() { if (this._cb) this._cb(); }
  _onChange(cb) { this._cb = cb; return this; }
  set(x, y, z, w) { this._x = x; this._y = y; this._z = z; this._w = w; this._melde(); return this; }
  copy(q) { this._x = q.x; this._y = q.y; this._z = q.z; this._w = q.w; this._melde(); return this; }
  clone() { return new Quaternion(this._x, this._y, this._z, this._w); }
  identity() { return this.set(0, 0, 0, 1); }
  conjugate() { this._x *= -1; this._y *= -1; this._z *= -1; this._melde(); return this; }
  invert() { return this.conjugate(); }
  lengthSq() { return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w; }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() {
    let l = this.length();
    if (l === 0) { this._x = 0; this._y = 0; this._z = 0; this._w = 1; }
    else { l = 1 / l; this._x *= l; this._y *= l; this._z *= l; this._w *= l; }
    this._melde();
    return this;
  }
  setFromEuler(e, melden) {
    const x = e._x, y = e._y, z = e._z, order = e._order;
    const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
    if (order === 'YXZ') {
      this._x = s1 * c2 * c3 + c1 * s2 * s3;
      this._y = c1 * s2 * c3 - s1 * c2 * s3;
      this._z = c1 * c2 * s3 - s1 * s2 * c3;
      this._w = c1 * c2 * c3 + s1 * s2 * s3;
    } else {                                   // XYZ
      this._x = s1 * c2 * c3 + c1 * s2 * s3;
      this._y = c1 * s2 * c3 - s1 * c2 * s3;
      this._z = c1 * c2 * s3 + s1 * s2 * c3;
      this._w = c1 * c2 * c3 - s1 * s2 * s3;
    }
    if (melden !== false) this._melde();
    return this;
  }
  setFromAxisAngle(axis, winkel) {
    const h = winkel / 2, s = Math.sin(h);
    this._x = axis.x * s; this._y = axis.y * s; this._z = axis.z * s; this._w = Math.cos(h);
    this._melde();
    return this;
  }
  setFromRotationMatrix(m) {
    const te = m.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    const trace = m11 + m22 + m33;
    let s;
    if (trace > 0) {
      s = 0.5 / Math.sqrt(trace + 1.0);
      this._w = 0.25 / s; this._x = (m32 - m23) * s; this._y = (m13 - m31) * s; this._z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      this._w = (m32 - m23) / s; this._x = 0.25 * s; this._y = (m12 + m21) / s; this._z = (m13 + m31) / s;
    } else if (m22 > m33) {
      s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      this._w = (m13 - m31) / s; this._x = (m12 + m21) / s; this._y = 0.25 * s; this._z = (m23 + m32) / s;
    } else {
      s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      this._w = (m21 - m12) / s; this._x = (m13 + m31) / s; this._y = (m23 + m32) / s; this._z = 0.25 * s;
    }
    this._melde();
    return this;
  }
  setFromUnitVectors(vFrom, vTo) {
    let r = vFrom.dot(vTo) + 1;
    if (r < Number.EPSILON) {
      r = 0;
      if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
        this._x = -vFrom.y; this._y = vFrom.x; this._z = 0; this._w = r;
      } else {
        this._x = 0; this._y = -vFrom.z; this._z = vFrom.y; this._w = r;
      }
    } else {
      this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
      this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
      this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
      this._w = r;
    }
    return this.normalize();
  }
  multiply(q) { return this.multiplyQuaternions(this, q); }
  premultiply(q) { return this.multiplyQuaternions(q, this); }
  multiplyQuaternions(a, b) {
    const qax = a.x, qay = a.y, qaz = a.z, qaw = a.w;
    const qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w;
    this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    this._melde();
    return this;
  }
}

/* --- Matrix3 / Matrix4 --------------------------------------------------- */
export class Matrix3 {
  constructor() { this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]; }
  setFromMatrix4(m) {
    const me = m.elements;
    this.elements = [me[0], me[1], me[2], me[4], me[5], me[6], me[8], me[9], me[10]];
    return this;
  }
  invert() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2];
    const n12 = te[3], n22 = te[4], n32 = te[5];
    const n13 = te[6], n23 = te[7], n33 = te[8];
    const t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13;
    const det = n11 * t11 + n21 * t12 + n31 * t13;
    if (det === 0) { this.elements = [0, 0, 0, 0, 0, 0, 0, 0, 0]; return this; }
    const d = 1 / det;
    this.elements = [
      t11 * d, (n31 * n23 - n33 * n21) * d, (n32 * n21 - n31 * n22) * d,
      t12 * d, (n33 * n11 - n31 * n13) * d, (n31 * n12 - n32 * n11) * d,
      t13 * d, (n21 * n13 - n23 * n11) * d, (n22 * n11 - n21 * n12) * d
    ];
    return this;
  }
  transpose() {
    const m = this.elements;
    this.elements = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
    return this;
  }
  getNormalMatrix(m4) { return this.setFromMatrix4(m4).invert().transpose(); }
}

export class Matrix4 {
  constructor() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    this.elements = [n11, n21, n31, n41, n12, n22, n32, n42,
                     n13, n23, n33, n43, n14, n24, n34, n44];
    return this;
  }
  identity() { return this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1); }
  copy(m) { this.elements = m.elements.slice(); return this; }
  clone() { return new Matrix4().copy(this); }
  makeTranslation(x, y, z) {
    if (x && x.isVector3) { z = x.z; y = x.y; x = x.x; }
    return this.set(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
  }
  makeScale(x, y, z) { return this.set(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1); }
  makeRotationX(t) {
    const c = Math.cos(t), s = Math.sin(t);
    return this.set(1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1);
  }
  makeRotationY(t) {
    const c = Math.cos(t), s = Math.sin(t);
    return this.set(c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1);
  }
  makeRotationZ(t) {
    const c = Math.cos(t), s = Math.sin(t);
    return this.set(c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
  }
  makeRotationAxis(axis, winkel) {
    const c = Math.cos(winkel), s = Math.sin(winkel), t = 1 - c;
    const x = axis.x, y = axis.y, z = axis.z, tx = t * x, ty = t * y;
    return this.set(
      tx * x + c, tx * y - s * z, tx * z + s * y, 0,
      tx * y + s * z, ty * y + c, ty * z - s * x, 0,
      tx * z - s * y, ty * z + s * x, t * z * z + c, 0,
      0, 0, 0, 1);
  }
  makeRotationFromQuaternion(q) { return this.compose(_v0, q, _v1); }
  multiply(m) { return this.multiplyMatrices(this, m); }
  premultiply(m) { return this.multiplyMatrices(m, this); }
  multiplyMatrices(a, b) {
    const ae = a.elements, be = b.elements, te = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        te[c * 4 + r] = ae[r] * be[c * 4] + ae[4 + r] * be[c * 4 + 1] +
                        ae[8 + r] * be[c * 4 + 2] + ae[12 + r] * be[c * 4 + 3];
      }
    }
    this.elements = te;
    return this;
  }
  compose(pos, q, sc) {
    const te = this.elements;
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = sc.x, sy = sc.y, sz = sc.z;
    te[0] = (1 - (yy + zz)) * sx; te[1] = (xy + wz) * sx; te[2] = (xz - wy) * sx; te[3] = 0;
    te[4] = (xy - wz) * sy; te[5] = (1 - (xx + zz)) * sy; te[6] = (yz + wx) * sy; te[7] = 0;
    te[8] = (xz + wy) * sz; te[9] = (yz - wx) * sz; te[10] = (1 - (xx + yy)) * sz; te[11] = 0;
    te[12] = pos.x; te[13] = pos.y; te[14] = pos.z; te[15] = 1;
    return this;
  }
  decompose(pos, q, sc) {
    const te = this.elements;
    let sx = new Vector3(te[0], te[1], te[2]).length();
    const sy = new Vector3(te[4], te[5], te[6]).length();
    const sz = new Vector3(te[8], te[9], te[10]).length();
    if (this.determinant() < 0) sx = -sx;
    pos.x = te[12]; pos.y = te[13]; pos.z = te[14];
    const m = _m2.copy(this), ix = 1 / sx, iy = 1 / sy, iz = 1 / sz;
    m.elements[0] *= ix; m.elements[1] *= ix; m.elements[2] *= ix;
    m.elements[4] *= iy; m.elements[5] *= iy; m.elements[6] *= iy;
    m.elements[8] *= iz; m.elements[9] *= iz; m.elements[10] *= iz;
    q.setFromRotationMatrix(m);
    sc.x = sx; sc.y = sy; sc.z = sz;
    return this;
  }
  determinant() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    return (
      n41 * (+n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 +
             n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34) +
      n42 * (+n11 * n23 * n34 - n11 * n24 * n33 + n14 * n21 * n33 -
             n13 * n21 * n34 + n13 * n24 * n31 - n14 * n23 * n31) +
      n43 * (+n11 * n24 * n32 - n11 * n22 * n34 - n14 * n21 * n32 +
             n12 * n21 * n34 + n14 * n22 * n31 - n12 * n24 * n31) +
      n44 * (-n13 * n22 * n31 - n11 * n23 * n32 + n11 * n22 * n33 +
             n13 * n21 * n32 - n12 * n21 * n33 + n12 * n23 * n31)
    );
  }
  setPosition(x, y, z) {
    if (x && x.isVector3 !== undefined || (x && typeof x === 'object')) {
      this.elements[12] = x.x; this.elements[13] = x.y; this.elements[14] = x.z;
    } else { this.elements[12] = x; this.elements[13] = y; this.elements[14] = z; }
    return this;
  }
  scale(v) {
    const te = this.elements, x = v.x, y = v.y, z = v.z;
    te[0] *= x; te[4] *= y; te[8] *= z;
    te[1] *= x; te[5] *= y; te[9] *= z;
    te[2] *= x; te[6] *= y; te[10] *= z;
    te[3] *= x; te[7] *= y; te[11] *= z;
    return this;
  }
  getMaxScaleOnAxis() {
    const te = this.elements;
    const a = te[0] * te[0] + te[1] * te[1] + te[2] * te[2];
    const b = te[4] * te[4] + te[5] * te[5] + te[6] * te[6];
    const c = te[8] * te[8] + te[9] * te[9] + te[10] * te[10];
    return Math.sqrt(Math.max(a, b, c));
  }
  invert() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];
    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) { this.elements = new Array(16).fill(0); return this; }
    const d = 1 / det;
    te[0] = t11 * d; te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * d;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * d;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * d;
    te[4] = t12 * d; te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * d;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * d;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * d;
    te[8] = t13 * d; te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * d;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * d;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * d;
    te[12] = t14 * d; te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * d;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * d;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * d;
    return this;
  }
}

const _v0 = new Vector3(0, 0, 0);
const _v1 = new Vector3(1, 1, 1);
const _q1 = new Quaternion();
const _m1 = new Matrix4();
const _m2 = new Matrix4();

/* --- Box3 / Sphere ------------------------------------------------------- */
export class Box3 {
  constructor(min, max) {
    this.min = min || new Vector3(+Infinity, +Infinity, +Infinity);
    this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);
  }
  makeEmpty() {
    this.min.set(+Infinity, +Infinity, +Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    return this;
  }
  isEmpty() { return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z; }
  expandByPoint(p) { this.min.min(p); this.max.max(p); return this; }
  setFromBufferAttribute(attr) {
    this.makeEmpty();
    for (let i = 0; i < attr.count; i++) {
      _vTmp.set(attr.getX(i), attr.getY(i), attr.getZ(i));
      this.expandByPoint(_vTmp);
    }
    return this;
  }
  getCenter(t) { return this.isEmpty() ? t.set(0, 0, 0) : t.addVectors(this.min, this.max).multiplyScalar(0.5); }
  getSize(t) { return this.isEmpty() ? t.set(0, 0, 0) : t.subVectors(this.max, this.min); }
  containsPoint(p) {
    return p.x >= this.min.x && p.x <= this.max.x && p.y >= this.min.y &&
           p.y <= this.max.y && p.z >= this.min.z && p.z <= this.max.z;
  }
  clone() { return new Box3(this.min.clone(), this.max.clone()); }
  copy(b) { this.min.copy(b.min); this.max.copy(b.max); return this; }
}
const _vTmp = new Vector3();

export class Sphere {
  constructor(center, radius) { this.center = center || new Vector3(); this.radius = radius === undefined ? -1 : radius; }
  set(c, r) { this.center.copy(c); this.radius = r; return this; }
  clone() { return new Sphere(this.center.clone(), this.radius); }
  copy(s) { this.center.copy(s.center); this.radius = s.radius; return this; }
}

export class Plane { constructor() { this.normal = new Vector3(1, 0, 0); this.constant = 0; } }
export class Frustum {
  constructor() { this.planes = [new Plane(), new Plane(), new Plane(), new Plane(), new Plane(), new Plane()]; }
  setFromProjectionMatrix() { return this; }
  containsPoint() { return true; }
  intersectsSphere() { return true; }
}

/* --- BufferAttribute ----------------------------------------------------- */
export class BufferAttribute {
  constructor(array, itemSize, normalized = false) {
    if (Array.isArray(array)) throw new TypeError('BufferAttribute: array muss ein TypedArray sein');
    this.array = array;
    this.itemSize = itemSize;
    this.count = array !== undefined ? array.length / itemSize : 0;
    this.normalized = normalized;
    this.usage = StaticDrawUsage;
    this.needsUpdate = false;
    this.version = 0;
    // Teil-Uploads (three r159+): world/terrain.js meldet je Patch nur den
    // geaenderten Bereich an. Ohne GL passiert hier nichts, die Bereiche
    // werden aber mitgefuehrt, damit ein Test sie lesen koennte.
    this.updateRanges = [];
    this.isBufferAttribute = true;
  }
  setUsage(u) { this.usage = u; return this; }
  addUpdateRange(start, count) { this.updateRanges.push({ start, count }); }
  clearUpdateRanges() { this.updateRanges.length = 0; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  getW(i) { return this.array[i * this.itemSize + 3]; }
  setX(i, x) { this.array[i * this.itemSize] = x; return this; }
  setY(i, y) { this.array[i * this.itemSize + 1] = y; return this; }
  setZ(i, z) { this.array[i * this.itemSize + 2] = z; return this; }
  setW(i, w) { this.array[i * this.itemSize + 3] = w; return this; }
  setXY(i, x, y) { const o = i * this.itemSize; this.array[o] = x; this.array[o + 1] = y; return this; }
  setXYZ(i, x, y, z) {
    const o = i * this.itemSize;
    this.array[o] = x; this.array[o + 1] = y; this.array[o + 2] = z;
    return this;
  }
  setXYZW(i, x, y, z, w) {
    const o = i * this.itemSize;
    this.array[o] = x; this.array[o + 1] = y; this.array[o + 2] = z; this.array[o + 3] = w;
    return this;
  }
  set(werte, offset = 0) { this.array.set(werte, offset); return this; }
  copyAt(i, attr, j) {
    i *= this.itemSize; j *= attr.itemSize;
    for (let k = 0; k < this.itemSize; k++) this.array[i + k] = attr.array[j + k];
    return this;
  }
  clone() {
    const a = new BufferAttribute(new this.array.constructor(this.array), this.itemSize, this.normalized);
    a.usage = this.usage;
    return a;
  }
  applyMatrix4(m) {
    for (let i = 0; i < this.count; i++) {
      _vTmp.fromBufferAttribute(this, i).applyMatrix4(m);
      this.setXYZ(i, _vTmp.x, _vTmp.y, _vTmp.z);
    }
    return this;
  }
  applyNormalMatrix(m) {
    for (let i = 0; i < this.count; i++) {
      _vTmp.fromBufferAttribute(this, i).applyNormalMatrix(m);
      this.setXYZ(i, _vTmp.x, _vTmp.y, _vTmp.z);
    }
    return this;
  }
  transformDirection(m) {
    for (let i = 0; i < this.count; i++) {
      _vTmp.fromBufferAttribute(this, i).transformDirection(m);
      this.setXYZ(i, _vTmp.x, _vTmp.y, _vTmp.z);
    }
    return this;
  }
}
export class Float32BufferAttribute extends BufferAttribute {
  constructor(a, itemSize, n) { super(a instanceof Float32Array ? a : new Float32Array(a), itemSize, n); }
}
export class Uint16BufferAttribute extends BufferAttribute {
  constructor(a, itemSize, n) { super(a instanceof Uint16Array ? a : new Uint16Array(a), itemSize, n); }
}
export class Uint32BufferAttribute extends BufferAttribute {
  constructor(a, itemSize, n) { super(a instanceof Uint32Array ? a : new Uint32Array(a), itemSize, n); }
}
export class InstancedBufferAttribute extends BufferAttribute {
  constructor(array, itemSize, normalized, meshPerAttribute = 1) {
    super(array, itemSize, normalized);
    this.meshPerAttribute = meshPerAttribute;
    this.isInstancedBufferAttribute = true;
  }
}

/* --- BufferGeometry ------------------------------------------------------ */
let geoId = 0;
export class BufferGeometry {
  constructor() {
    this.id = geoId++;
    this.uuid = 'geo' + this.id;
    this.name = '';
    this.type = 'BufferGeometry';
    this.attributes = {};
    this.index = null;
    this.groups = [];
    this.boundingBox = null;
    this.boundingSphere = null;
    this.drawRange = { start: 0, count: Infinity };
    this.userData = {};
    this.isBufferGeometry = true;
  }
  setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  getAttribute(name) { return this.attributes[name]; }
  hasAttribute(name) { return this.attributes[name] !== undefined; }
  deleteAttribute(name) { delete this.attributes[name]; return this; }
  setIndex(idx) {
    if (idx === null) { this.index = null; return this; }
    if (Array.isArray(idx)) {
      const gross = idx.length && Math.max.apply(null, idx) > 65535;
      this.index = new BufferAttribute(gross ? new Uint32Array(idx) : new Uint16Array(idx), 1);
    } else {
      this.index = idx;
    }
    return this;
  }
  getIndex() { return this.index; }
  addGroup(start, count, materialIndex = 0) { this.groups.push({ start, count, materialIndex }); }
  clearGroups() { this.groups.length = 0; }
  setDrawRange(start, count) { this.drawRange = { start, count }; }
  setFromPoints(punkte) {
    const pos = new Float32Array(punkte.length * 3);
    for (let i = 0; i < punkte.length; i++) {
      pos[i * 3] = punkte[i].x; pos[i * 3 + 1] = punkte[i].y; pos[i * 3 + 2] = punkte[i].z || 0;
    }
    return this.setAttribute('position', new BufferAttribute(pos, 3));
  }
  clone() { return new BufferGeometry().copy(this); }
  copy(quelle) {
    this.attributes = {};
    for (const name in quelle.attributes) this.attributes[name] = quelle.attributes[name].clone();
    this.index = quelle.index ? quelle.index.clone() : null;
    this.groups = quelle.groups.map((g) => ({ ...g }));
    this.boundingBox = quelle.boundingBox ? quelle.boundingBox.clone() : null;
    this.boundingSphere = quelle.boundingSphere ? quelle.boundingSphere.clone() : null;
    this.drawRange = { ...quelle.drawRange };
    return this;
  }
  applyMatrix4(m) {
    const pos = this.attributes.position;
    if (pos) { pos.applyMatrix4(m); pos.needsUpdate = true; }
    const nor = this.attributes.normal;
    if (nor) { nor.applyNormalMatrix(new Matrix3().getNormalMatrix(m)); nor.needsUpdate = true; }
    if (this.boundingBox) this.computeBoundingBox();
    if (this.boundingSphere) this.computeBoundingSphere();
    return this;
  }
  applyQuaternion(q) { return this.applyMatrix4(_m1.makeRotationFromQuaternion(q)); }
  rotateX(t) { return this.applyMatrix4(new Matrix4().makeRotationX(t)); }
  rotateY(t) { return this.applyMatrix4(new Matrix4().makeRotationY(t)); }
  rotateZ(t) { return this.applyMatrix4(new Matrix4().makeRotationZ(t)); }
  translate(x, y, z) { return this.applyMatrix4(new Matrix4().makeTranslation(x, y, z)); }
  scale(x, y, z) { return this.applyMatrix4(new Matrix4().makeScale(x, y, z)); }
  center() {
    this.computeBoundingBox();
    this.boundingBox.getCenter(_vTmp).negate();
    return this.translate(_vTmp.x, _vTmp.y, _vTmp.z);
  }
  computeBoundingBox() {
    if (!this.boundingBox) this.boundingBox = new Box3();
    const pos = this.attributes.position;
    if (!pos) { this.boundingBox.makeEmpty(); return; }
    this.boundingBox.setFromBufferAttribute(pos);
  }
  computeBoundingSphere() {
    if (!this.boundingSphere) this.boundingSphere = new Sphere();
    const pos = this.attributes.position;
    if (!pos) { this.boundingSphere.radius = 0; return; }
    const box = new Box3().setFromBufferAttribute(pos);
    const mitte = box.getCenter(new Vector3());
    let maxSq = 0;
    for (let i = 0; i < pos.count; i++) {
      _vTmp.fromBufferAttribute(pos, i);
      maxSq = Math.max(maxSq, mitte.distanceToSquared(_vTmp));
    }
    this.boundingSphere.center.copy(mitte);
    this.boundingSphere.radius = Math.sqrt(maxSq);
  }
  computeVertexNormals() {
    const pos = this.attributes.position;
    if (!pos) return;
    let nor = this.attributes.normal;
    if (!nor || nor.count !== pos.count) {
      nor = new BufferAttribute(new Float32Array(pos.count * 3), 3);
      this.setAttribute('normal', nor);
    } else {
      nor.array.fill(0);
    }
    const pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
    const cb = new Vector3(), ab = new Vector3();
    const addiere = (a, b, c) => {
      pA.fromBufferAttribute(pos, a); pB.fromBufferAttribute(pos, b); pC.fromBufferAttribute(pos, c);
      cb.subVectors(pC, pB); ab.subVectors(pA, pB); cb.cross(ab);
      for (const i of [a, b, c]) {
        nor.setXYZ(i, nor.getX(i) + cb.x, nor.getY(i) + cb.y, nor.getZ(i) + cb.z);
      }
    };
    if (this.index) {
      const ix = this.index.array;
      for (let i = 0; i < this.index.count; i += 3) addiere(ix[i], ix[i + 1], ix[i + 2]);
    } else {
      for (let i = 0; i < pos.count; i += 3) addiere(i, i + 1, i + 2);
    }
    this.normalizeNormals();
    nor.needsUpdate = true;
  }
  normalizeNormals() {
    const nor = this.attributes.normal;
    if (!nor) return;
    for (let i = 0; i < nor.count; i++) {
      _vTmp.fromBufferAttribute(nor, i).normalize();
      nor.setXYZ(i, _vTmp.x, _vTmp.y, _vTmp.z);
    }
  }
  toNonIndexed() {
    if (!this.index) return this;
    const out = new BufferGeometry();
    const ix = this.index.array;
    for (const name in this.attributes) {
      const attr = this.attributes[name], gr = attr.itemSize;
      const neu = new attr.array.constructor(ix.length * gr);
      for (let i = 0; i < ix.length; i++) {
        const von = ix[i] * gr, nach = i * gr;
        for (let k = 0; k < gr; k++) neu[nach + k] = attr.array[von + k];
      }
      out.setAttribute(name, new BufferAttribute(neu, gr, attr.normalized));
    }
    return out;
  }
  dispose() {}
}

/* ==========================================================================
   Primitive Geometrien — echte Vertexdaten nach denselben Formeln wie Three.
   ========================================================================== */
function fertig(geo, pos, nor, uv, idx) {
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  if (idx) geo.setIndex(idx.length && Math.max.apply(null, idx) > 65535
    ? new BufferAttribute(new Uint32Array(idx), 1)
    : new BufferAttribute(new Uint16Array(idx), 1));
  return geo;
}

export class PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
    super();
    this.type = 'PlaneGeometry';
    this.parameters = { width, height, widthSegments, heightSegments };
    const hw = width / 2, hh = height / 2;
    const gx = Math.floor(widthSegments), gy = Math.floor(heightSegments);
    const gx1 = gx + 1, gy1 = gy + 1;
    const sw = width / gx, sh = height / gy;
    const idx = [], pos = [], nor = [], uv = [];
    for (let iy = 0; iy < gy1; iy++) {
      const y = iy * sh - hh;
      for (let ix = 0; ix < gx1; ix++) {
        const x = ix * sw - hw;
        pos.push(x, -y, 0);
        nor.push(0, 0, 1);
        uv.push(ix / gx, 1 - iy / gy);
      }
    }
    for (let iy = 0; iy < gy; iy++) {
      for (let ix = 0; ix < gx; ix++) {
        const a = ix + gx1 * iy, b = ix + gx1 * (iy + 1);
        const c = ix + 1 + gx1 * (iy + 1), d = ix + 1 + gx1 * iy;
        idx.push(a, b, d, b, c, d);
      }
    }
    fertig(this, pos, nor, uv, idx);
  }
}

export class BoxGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1) {
    super();
    this.type = 'BoxGeometry';
    this.parameters = { width, height, depth, widthSegments, heightSegments, depthSegments };
    const idx = [], pos = [], nor = [], uv = [];
    let zaehler = 0;
    const ws = Math.floor(widthSegments), hs = Math.floor(heightSegments), ds = Math.floor(depthSegments);
    const seite = (u, v, w, udir, vdir, breite, hoehe, tiefe, gridX, gridY) => {
      const segBreite = breite / gridX, segHoehe = hoehe / gridY;
      const hb = breite / 2, hh = hoehe / 2, ht = tiefe / 2;
      const gx1 = gridX + 1, gy1 = gridY + 1;
      let anzahl = 0;
      const vec = new Vector3();
      for (let iy = 0; iy < gy1; iy++) {
        const y = iy * segHoehe - hh;
        for (let ix = 0; ix < gx1; ix++) {
          const x = ix * segBreite - hb;
          vec[u] = x * udir; vec[v] = y * vdir; vec[w] = ht;
          pos.push(vec.x, vec.y, vec.z);
          vec[u] = 0; vec[v] = 0; vec[w] = tiefe > 0 ? 1 : -1;
          nor.push(vec.x, vec.y, vec.z);
          uv.push(ix / gridX, 1 - iy / gridY);
          anzahl++;
        }
      }
      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = zaehler + ix + gx1 * iy, b = zaehler + ix + gx1 * (iy + 1);
          const c = zaehler + ix + 1 + gx1 * (iy + 1), d = zaehler + ix + 1 + gx1 * iy;
          idx.push(a, b, d, b, c, d);
        }
      }
      zaehler += anzahl;
    };
    seite('z', 'y', 'x', -1, -1, depth, height, width, ds, hs);      // px
    seite('z', 'y', 'x', 1, -1, depth, height, -width, ds, hs);      // nx
    seite('x', 'z', 'y', 1, 1, width, depth, height, ws, ds);        // py
    seite('x', 'z', 'y', 1, -1, width, depth, -height, ws, ds);      // ny
    seite('x', 'y', 'z', 1, -1, width, height, depth, ws, hs);       // pz
    seite('x', 'y', 'z', -1, -1, width, height, -depth, ws, hs);     // nz
    fertig(this, pos, nor, uv, idx);
  }
}

export class SphereGeometry extends BufferGeometry {
  constructor(radius = 1, widthSegments = 32, heightSegments = 16,
              phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
    super();
    this.type = 'SphereGeometry';
    this.parameters = { radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength };
    const wS = Math.max(3, Math.floor(widthSegments));
    const hS = Math.max(2, Math.floor(heightSegments));
    const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);
    const gitter = [], idx = [], pos = [], nor = [], uv = [];
    let index = 0;
    const normal = new Vector3();
    for (let iy = 0; iy <= hS; iy++) {
      const reihe = [], v = iy / hS;
      let uOffset = 0;
      if (iy === 0 && thetaStart === 0) uOffset = 0.5 / wS;
      else if (iy === hS && thetaEnd === Math.PI) uOffset = -0.5 / wS;
      for (let ix = 0; ix <= wS; ix++) {
        const u = ix / wS;
        const x = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
        const y = radius * Math.cos(thetaStart + v * thetaLength);
        const z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
        pos.push(x, y, z);
        normal.set(x, y, z).normalize();
        nor.push(normal.x, normal.y, normal.z);
        uv.push(u + uOffset, 1 - v);
        reihe.push(index++);
      }
      gitter.push(reihe);
    }
    for (let iy = 0; iy < hS; iy++) {
      for (let ix = 0; ix < wS; ix++) {
        const a = gitter[iy][ix + 1], b = gitter[iy][ix];
        const c = gitter[iy + 1][ix], d = gitter[iy + 1][ix + 1];
        if (iy !== 0 || thetaStart > 0) idx.push(a, b, d);
        if (iy !== hS - 1 || thetaEnd < Math.PI) idx.push(b, c, d);
      }
    }
    fertig(this, pos, nor, uv, idx);
  }
}

export class TorusGeometry extends BufferGeometry {
  constructor(radius = 1, tube = 0.4, radialSegments = 12, tubularSegments = 48, arc = Math.PI * 2) {
    super();
    this.type = 'TorusGeometry';
    this.parameters = { radius, tube, radialSegments, tubularSegments, arc };
    const rS = Math.floor(radialSegments), tS = Math.floor(tubularSegments);
    const idx = [], pos = [], nor = [], uv = [];
    const mitte = new Vector3(), vertex = new Vector3(), normal = new Vector3();
    for (let j = 0; j <= rS; j++) {
      for (let i = 0; i <= tS; i++) {
        const u = i / tS * arc, v = j / rS * Math.PI * 2;
        vertex.x = (radius + tube * Math.cos(v)) * Math.cos(u);
        vertex.y = (radius + tube * Math.cos(v)) * Math.sin(u);
        vertex.z = tube * Math.sin(v);
        pos.push(vertex.x, vertex.y, vertex.z);
        mitte.x = radius * Math.cos(u); mitte.y = radius * Math.sin(u); mitte.z = 0;
        normal.subVectors(vertex, mitte).normalize();
        nor.push(normal.x, normal.y, normal.z);
        uv.push(i / tS, j / rS);
      }
    }
    for (let j = 1; j <= rS; j++) {
      for (let i = 1; i <= tS; i++) {
        const a = (tS + 1) * j + i - 1, b = (tS + 1) * (j - 1) + i - 1;
        const c = (tS + 1) * (j - 1) + i, d = (tS + 1) * j + i;
        idx.push(a, b, d, b, c, d);
      }
    }
    fertig(this, pos, nor, uv, idx);
  }
}

export class CylinderGeometry extends BufferGeometry {
  constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32,
              heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2) {
    super();
    this.type = 'CylinderGeometry';
    this.parameters = { radiusTop, radiusBottom, height, radialSegments, heightSegments,
      openEnded, thetaStart, thetaLength };
    const rS = Math.floor(radialSegments), hS = Math.floor(heightSegments);
    const idx = [], pos = [], nor = [], uv = [];
    let index = 0;
    const indexReihen = [];
    const halb = height / 2;
    const steigung = (radiusBottom - radiusTop) / height;
    const normal = new Vector3();
    for (let y = 0; y <= hS; y++) {
      const reihe = [], v = y / hS;
      const radius = v * (radiusBottom - radiusTop) + radiusTop;
      for (let x = 0; x <= rS; x++) {
        const u = x / rS, theta = u * thetaLength + thetaStart;
        const sinT = Math.sin(theta), cosT = Math.cos(theta);
        pos.push(radius * sinT, -v * height + halb, radius * cosT);
        normal.set(sinT, steigung, cosT).normalize();
        nor.push(normal.x, normal.y, normal.z);
        uv.push(u, 1 - v);
        reihe.push(index++);
      }
      indexReihen.push(reihe);
    }
    for (let x = 0; x < rS; x++) {
      for (let y = 0; y < hS; y++) {
        const a = indexReihen[y][x], b = indexReihen[y + 1][x];
        const c = indexReihen[y + 1][x + 1], d = indexReihen[y][x + 1];
        if (radiusTop > 0 || y !== 0) idx.push(a, b, d);
        if (radiusBottom > 0 || y !== hS - 1) idx.push(b, c, d);
      }
    }
    const deckel = (oben) => {
      const radius = oben ? radiusTop : radiusBottom;
      const zeichen = oben ? 1 : -1;
      const mitteStart = index;
      for (let x = 1; x <= rS; x++) {
        pos.push(0, halb * zeichen, 0);
        nor.push(0, zeichen, 0);
        uv.push(0.5, 0.5);
        index++;
      }
      const randStart = index;
      for (let x = 0; x <= rS; x++) {
        const theta = x / rS * thetaLength + thetaStart;
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        pos.push(radius * sinT, halb * zeichen, radius * cosT);
        nor.push(0, zeichen, 0);
        uv.push(cosT * 0.5 + 0.5, sinT * 0.5 * zeichen + 0.5);
        index++;
      }
      for (let x = 0; x < rS; x++) {
        const c = mitteStart + x, i = randStart + x;
        if (oben) idx.push(i, i + 1, c); else idx.push(i + 1, i, c);
      }
    };
    if (!openEnded) {
      if (radiusTop > 0) deckel(true);
      if (radiusBottom > 0) deckel(false);
    }
    fertig(this, pos, nor, uv, idx);
  }
}

export class ConeGeometry extends CylinderGeometry {
  constructor(radius = 1, height = 1, radialSegments = 32, heightSegments = 1,
              openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2) {
    super(0, radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength);
    this.type = 'ConeGeometry';
  }
}

export class CircleGeometry extends BufferGeometry {
  constructor(radius = 1, segments = 32, thetaStart = 0, thetaLength = Math.PI * 2) {
    super();
    this.type = 'CircleGeometry';
    this.parameters = { radius, segments, thetaStart, thetaLength };
    const s = Math.max(3, Math.floor(segments));
    const idx = [], pos = [0, 0, 0], nor = [0, 0, 1], uv = [0.5, 0.5];
    for (let i = 0, j = 3; i <= s; i++, j += 3) {
      const segment = thetaStart + i / s * thetaLength;
      const x = radius * Math.cos(segment), y = radius * Math.sin(segment);
      pos.push(x, y, 0);
      nor.push(0, 0, 1);
      uv.push((x / radius + 1) / 2, (y / radius + 1) / 2);
    }
    for (let i = 1; i <= s; i++) idx.push(i, i + 1, 0);
    fertig(this, pos, nor, uv, idx);
  }
}

/* Polyeder samt Ikosaeder: Schritt fuer Schritt nachgebaut wie in Three
   (Unterteilung, Radius, UV-Erzeugung mit Pol- und Nahtkorrektur). Gegen die
   echte Fassung 0.185.1 geprueft — Position, Normale, UV und Index stimmen
   bitgleich ueberein. */
export class PolyhedronGeometry extends BufferGeometry {
  constructor(ecken = [], indizes = [], radius = 1, detail = 0) {
    super();
    this.type = 'PolyhedronGeometry';
    this.parameters = { vertices: ecken, indices: indizes, radius, detail };
    const punkte = [], uvs = [];

    const holeEcke = (index, ziel) => {
      const s = index * 3;
      ziel.set(ecken[s], ecken[s + 1], ecken[s + 2]);
    };
    const schreibe = (v) => { punkte.push(v.x, v.y, v.z); };
    const azimut = (v) => Math.atan2(v.z, -v.x);
    const neigung = (v) => Math.atan2(-v.y, Math.sqrt(v.x * v.x + v.z * v.z));

    const unterteileFlaeche = (a, b, c, tiefe) => {
      const spalten = tiefe + 1;
      const v = [];
      for (let i = 0; i <= spalten; i++) {
        v[i] = [];
        const aj = a.clone().lerp(c, i / spalten);
        const bj = b.clone().lerp(c, i / spalten);
        const zeilen = spalten - i;
        for (let j = 0; j <= zeilen; j++) {
          v[i][j] = (j === 0 && i === spalten) ? aj : aj.clone().lerp(bj, j / zeilen);
        }
      }
      for (let i = 0; i < spalten; i++) {
        for (let j = 0; j < 2 * (spalten - i) - 1; j++) {
          const k = Math.floor(j / 2);
          if (j % 2 === 0) {
            schreibe(v[i][k + 1]); schreibe(v[i + 1][k]); schreibe(v[i][k]);
          } else {
            schreibe(v[i][k + 1]); schreibe(v[i + 1][k + 1]); schreibe(v[i + 1][k]);
          }
        }
      }
    };

    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < indizes.length; i += 3) {
      holeEcke(indizes[i], a); holeEcke(indizes[i + 1], b); holeEcke(indizes[i + 2], c);
      unterteileFlaeche(a, b, c, detail);
    }

    const vertex = new Vector3();
    for (let i = 0; i < punkte.length; i += 3) {
      vertex.set(punkte[i], punkte[i + 1], punkte[i + 2]).normalize().multiplyScalar(radius);
      punkte[i] = vertex.x; punkte[i + 1] = vertex.y; punkte[i + 2] = vertex.z;
    }
    for (let i = 0; i < punkte.length; i += 3) {
      vertex.set(punkte[i], punkte[i + 1], punkte[i + 2]);
      uvs.push(azimut(vertex) / 2 / Math.PI + 0.5, 1 - (neigung(vertex) / Math.PI + 0.5));
    }
    /* Polkorrektur: an den Polen ist der Azimut unbestimmt, dort wird der des
       Dreiecksschwerpunkts genommen. */
    const uvA = new Vector2(), uvB = new Vector2(), uvC = new Vector2();
    const schwerpunkt = new Vector3();
    const korrigiere = (uv, stelle, punkt, azi) => {
      if (azi < 0 && uv.x === 1) uvs[stelle] = uv.x - 1;
      if (punkt.x === 0 && punkt.z === 0) uvs[stelle] = azi / 2 / Math.PI + 0.5;
    };
    for (let i = 0, j = 0; i < punkte.length; i += 9, j += 6) {
      a.set(punkte[i], punkte[i + 1], punkte[i + 2]);
      b.set(punkte[i + 3], punkte[i + 4], punkte[i + 5]);
      c.set(punkte[i + 6], punkte[i + 7], punkte[i + 8]);
      uvA.set(uvs[j], uvs[j + 1]); uvB.set(uvs[j + 2], uvs[j + 3]); uvC.set(uvs[j + 4], uvs[j + 5]);
      schwerpunkt.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      const azi = azimut(schwerpunkt);
      korrigiere(uvA, j, a, azi); korrigiere(uvB, j + 2, b, azi); korrigiere(uvC, j + 4, c, azi);
    }
    /* Nahtkorrektur: Dreiecke, die ueber die Texturnaht laufen. */
    for (let i = 0; i < uvs.length; i += 6) {
      const x0 = uvs[i], x1 = uvs[i + 2], x2 = uvs[i + 4];
      if (Math.max(x0, x1, x2) > 0.9 && Math.min(x0, x1, x2) < 0.1) {
        if (x0 < 0.2) uvs[i] += 1;
        if (x1 < 0.2) uvs[i + 2] += 1;
        if (x2 < 0.2) uvs[i + 4] += 1;
      }
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(punkte), 3));
    this.setAttribute('normal', new BufferAttribute(new Float32Array(punkte), 3));
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    if (detail === 0) this.computeVertexNormals(); else this.normalizeNormals();
  }
}

export class IcosahedronGeometry extends PolyhedronGeometry {
  constructor(radius = 1, detail = 0) {
    const t = (1 + Math.sqrt(5)) / 2;
    super([
      -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0,
      0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t,
      t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1
    ], [
      0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
      1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
      3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
      4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
    ], radius, detail);
    this.type = 'IcosahedronGeometry';
    this.parameters = { radius, detail };
  }
}

/* --- Kurven -------------------------------------------------------------- */
function kubischPoly() {
  return {
    c0: 0, c1: 0, c2: 0, c3: 0,
    init(x0, x1, t0, t1) {
      this.c0 = x0; this.c1 = t0;
      this.c2 = -3 * x0 + 3 * x1 - 2 * t0 - t1;
      this.c3 = 2 * x0 - 2 * x1 + t0 + t1;
    },
    initNonuniformCatmullRom(x0, x1, x2, x3, dt0, dt1, dt2) {
      let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
      let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
      t1 *= dt1; t2 *= dt1;
      this.init(x1, x2, t1, t2);
    },
    initCatmullRom(x0, x1, x2, x3, tension) {
      this.init(x1, x2, tension * (x2 - x0), tension * (x3 - x1));
    },
    calc(t) {
      const t2 = t * t, t3 = t2 * t;
      return this.c0 + this.c1 * t + this.c2 * t2 + this.c3 * t3;
    }
  };
}

export class CatmullRomCurve3 {
  constructor(points = [], closed = false, curveType = 'centripetal', tension = 0.5) {
    this.points = points;
    this.closed = closed;
    this.curveType = curveType;
    this.tension = tension;
    this.arcLengthDivisions = 200;
    this._laengen = null;
    this._px = kubischPoly(); this._py = kubischPoly(); this._pz = kubischPoly();
  }
  getPoint(t, ziel = new Vector3()) {
    const points = this.points, l = points.length;
    const p = (l - (this.closed ? 0 : 1)) * t;
    let intPoint = Math.floor(p), weight = p - intPoint;
    if (this.closed) {
      intPoint += intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / l) + 1) * l;
    } else if (weight === 0 && intPoint === l - 1) {
      intPoint = l - 2; weight = 1;
    }
    let p0, p3;
    if (this.closed || intPoint > 0) p0 = points[(intPoint - 1) % l];
    else { _tmpVecA.subVectors(points[0], points[1]).add(points[0]); p0 = _tmpVecA; }
    const p1 = points[intPoint % l];
    const p2 = points[(intPoint + 1) % l];
    if (this.closed || intPoint + 2 < l) p3 = points[(intPoint + 2) % l];
    else { _tmpVecB.subVectors(points[l - 1], points[l - 2]).add(points[l - 1]); p3 = _tmpVecB; }
    if (this.curveType === 'centripetal' || this.curveType === 'chordal') {
      const pow = this.curveType === 'chordal' ? 0.5 : 0.25;
      let dt0 = Math.pow(p0.distanceToSquared(p1), pow);
      let dt1 = Math.pow(p1.distanceToSquared(p2), pow);
      let dt2 = Math.pow(p2.distanceToSquared(p3), pow);
      if (dt1 < 1e-4) dt1 = 1.0;
      if (dt0 < 1e-4) dt0 = dt1;
      if (dt2 < 1e-4) dt2 = dt1;
      this._px.initNonuniformCatmullRom(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
      this._py.initNonuniformCatmullRom(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
      this._pz.initNonuniformCatmullRom(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
    } else {
      this._px.initCatmullRom(p0.x, p1.x, p2.x, p3.x, this.tension);
      this._py.initCatmullRom(p0.y, p1.y, p2.y, p3.y, this.tension);
      this._pz.initCatmullRom(p0.z, p1.z, p2.z, p3.z, this.tension);
    }
    return ziel.set(this._px.calc(weight), this._py.calc(weight), this._pz.calc(weight));
  }
  getPoints(divisions = 5) {
    const out = [];
    for (let d = 0; d <= divisions; d++) out.push(this.getPoint(d / divisions));
    return out;
  }
  getLengths(divisions = this.arcLengthDivisions) {
    if (this._laengen && this._laengen.length === divisions + 1) return this._laengen;
    const cache = [];
    let last = this.getPoint(0, new Vector3()), sum = 0;
    cache.push(0);
    for (let p = 1; p <= divisions; p++) {
      const aktuell = this.getPoint(p / divisions, new Vector3());
      sum += aktuell.distanceTo(last);
      cache.push(sum);
      last = aktuell;
    }
    this._laengen = cache;
    return cache;
  }
  getLength() { const l = this.getLengths(); return l[l.length - 1]; }
  getUtoTmapping(u, distanz) {
    const arc = this.getLengths();
    const ziel = distanz !== undefined ? distanz : u * arc[arc.length - 1];
    let low = 0, high = arc.length - 1, i;
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2);
      const diff = arc[i] - ziel;
      if (diff < 0) low = i + 1;
      else if (diff > 0) high = i - 1;
      else { high = i; break; }
    }
    i = high;
    if (arc[i] === ziel) return i / (arc.length - 1);
    const vorher = arc[i], segment = arc[i + 1] - vorher;
    return (i + (ziel - vorher) / segment) / (arc.length - 1);
  }
  getSpacedPoints(divisions = 5) {
    const out = [];
    for (let d = 0; d <= divisions; d++) out.push(this.getPoint(this.getUtoTmapping(d / divisions)));
    return out;
  }
  getTangent(t, ziel = new Vector3()) {
    const delta = 0.0001;
    let t1 = t - delta, t2 = t + delta;
    if (t1 < 0) t1 = 0;
    if (t2 > 1) t2 = 1;
    const pt1 = this.getPoint(t1, new Vector3()), pt2 = this.getPoint(t2, new Vector3());
    return ziel.copy(pt2).sub(pt1).normalize();
  }
  getTangentAt(u, ziel) { return this.getTangent(this.getUtoTmapping(u), ziel); }
  getPointAt(u, ziel) { return this.getPoint(this.getUtoTmapping(u), ziel); }
}
const _tmpVecA = new Vector3(), _tmpVecB = new Vector3();

/* --- Objekthierarchie ---------------------------------------------------- */
let objId = 0;
export class Object3D {
  constructor() {
    this.id = objId++;
    this.uuid = 'obj' + this.id;
    this.name = '';
    this.type = 'Object3D';
    this.parent = null;
    this.children = [];
    this.up = new Vector3(0, 1, 0);
    this.position = new Vector3();
    this.rotation = new Euler();
    this.quaternion = new Quaternion();
    this.scale = new Vector3(1, 1, 1);
    this.matrix = new Matrix4();
    this.matrixWorld = new Matrix4();
    this.matrixAutoUpdate = true;
    this.matrixWorldNeedsUpdate = false;
    this.visible = true;
    this.renderOrder = 0;
    this.frustumCulled = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.userData = {};
    this.layers = { set() {}, enable() {}, mask: 1 };
    this.isObject3D = true;
    const self = this;
    this.rotation._onChange(() => { self.quaternion.setFromEuler(self.rotation, false); });
    this.quaternion._onChange(() => { self.rotation.setFromQuaternion(self.quaternion, undefined); });
  }
  add(...objekte) {
    for (const o of objekte) {
      if (!o || o === this) continue;
      if (o.parent) o.parent.remove(o);
      o.parent = this;
      this.children.push(o);
    }
    return this;
  }
  remove(...objekte) {
    for (const o of objekte) {
      const i = this.children.indexOf(o);
      if (i >= 0) { this.children.splice(i, 1); o.parent = null; }
    }
    return this;
  }
  clear() { return this.remove(...this.children.slice()); }
  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixWorldNeedsUpdate = true;
  }
  updateMatrixWorld() {
    this.updateMatrix();
    if (this.parent) this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    else this.matrixWorld.copy(this.matrix);
    for (const k of this.children) k.updateMatrixWorld();
  }
  updateWorldMatrix() { this.updateMatrixWorld(); }
  traverse(fn) { fn(this); for (const k of this.children) k.traverse(fn); }
  traverseVisible(fn) { if (!this.visible) return; fn(this); for (const k of this.children) k.traverseVisible(fn); }
  getObjectByName(n) {
    if (this.name === n) return this;
    for (const k of this.children) { const t = k.getObjectByName(n); if (t) return t; }
    return null;
  }
  lookAt() { return this; }
  localToWorld(v) { return v.applyMatrix4(this.matrixWorld); }
  worldToLocal(v) { return v.applyMatrix4(_m1.copy(this.matrixWorld).invert()); }
  getWorldPosition(t) { return t.setFromMatrixPosition(this.matrixWorld); }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {}
}

export class Group extends Object3D {
  constructor() { super(); this.type = 'Group'; this.isGroup = true; }
}
export class Scene extends Object3D {
  constructor() {
    super();
    this.type = 'Scene';
    this.isScene = true;
    this.background = null;
    this.fog = null;
    this.environment = null;
    this.overrideMaterial = null;
  }
}
export class Fog {
  constructor(color, near = 1, far = 1000) {
    this.color = new Color(color); this.near = near; this.far = far; this.isFog = true;
  }
}
export class FogExp2 {
  constructor(color, density = 0.00025) { this.color = new Color(color); this.density = density; }
}

export class Mesh extends Object3D {
  constructor(geometry = new BufferGeometry(), material = new MeshBasicMaterial()) {
    super();
    this.type = 'Mesh';
    this.geometry = geometry;
    this.material = material;
    this.isMesh = true;
  }
}
export class Line extends Mesh { constructor(g, m) { super(g, m); this.type = 'Line'; this.isLine = true; } }
export class LineLoop extends Line { constructor(g, m) { super(g, m); this.type = 'LineLoop'; } }
export class LineSegments extends Line { constructor(g, m) { super(g, m); this.type = 'LineSegments'; } }
export class Points extends Mesh { constructor(g, m) { super(g, m); this.type = 'Points'; this.isPoints = true; } }
export class Sprite extends Object3D {
  constructor(material) { super(); this.type = 'Sprite'; this.material = material; this.isSprite = true; this.center = new Vector2(0.5, 0.5); }
}

export class InstancedMesh extends Mesh {
  constructor(geometry, material, count) {
    super(geometry, material);
    this.type = 'InstancedMesh';
    this.isInstancedMesh = true;
    this.instanceMatrix = new InstancedBufferAttribute(new Float32Array(count * 16), 16);
    this.instanceColor = null;
    this.morphTexture = null;
    this.count = count;
    this.maxCount = count;
    for (let i = 0; i < count; i++) this.setMatrixAt(i, _m1.identity());
  }
  setMatrixAt(i, m) { this.instanceMatrix.array.set(m.elements, i * 16); }
  getMatrixAt(i, m) { m.elements = Array.from(this.instanceMatrix.array.slice(i * 16, i * 16 + 16)); return m; }
  setColorAt(i, c) {
    if (this.instanceColor === null) {
      this.instanceColor = new InstancedBufferAttribute(new Float32Array(this.maxCount * 3).fill(1), 3);
    }
    this.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }
  getColorAt(i, c) {
    return c.setRGB(this.instanceColor.getX(i), this.instanceColor.getY(i), this.instanceColor.getZ(i));
  }
  computeBoundingSphere() {}
  dispose() { return this; }
}

/* --- Materialien / Texturen (Huellen) ------------------------------------ */
let matId = 0;
class Material {
  constructor(opts) {
    this.id = matId++;
    this.uuid = 'mat' + this.id;
    this.type = 'Material';
    this.color = new Color(0xffffff);
    this.opacity = 1;
    this.transparent = false;
    this.visible = true;
    this.side = FrontSide;
    this.vertexColors = false;
    this.depthWrite = true;
    this.depthTest = true;
    this.needsUpdate = false;
    this.userData = {};
    this.onBeforeCompile = function () {};
    this.customProgramCacheKey = function () { return ''; };
    this.isMaterial = true;
    if (opts) this.setValues(opts);
  }
  setValues(opts) {
    for (const k in opts) {
      const wert = opts[k];
      if (wert === undefined) continue;
      const aktuell = this[k];
      if (aktuell && aktuell instanceof Color && !(wert instanceof Color)) aktuell.set(wert);
      else if (aktuell && aktuell instanceof Color && wert instanceof Color) aktuell.copy(wert);
      else this[k] = wert;
    }
  }
  clone() { const m = new this.constructor(); m.setValues(this); return m; }
  copy(m) { this.setValues(m); return this; }
  dispose() {}
}
export { Material };
export class MeshBasicMaterial extends Material {
  constructor(o) { super(); this.type = 'MeshBasicMaterial'; this.map = null; this.alphaTest = 0; if (o) this.setValues(o); }
}
export class MeshLambertMaterial extends MeshBasicMaterial {
  constructor(o) { super(); this.type = 'MeshLambertMaterial'; this.emissive = new Color(0x000000); if (o) this.setValues(o); }
}
export class MeshPhongMaterial extends MeshBasicMaterial {
  constructor(o) {
    super();
    this.type = 'MeshPhongMaterial';
    this.specular = new Color(0x111111);
    this.emissive = new Color(0x000000);
    this.emissiveIntensity = 1;
    this.shininess = 30;
    if (o) this.setValues(o);
  }
}
export class MeshDepthMaterial extends Material {
  constructor(o) { super(); this.type = 'MeshDepthMaterial'; if (o) this.setValues(o); }
}
export class MeshStandardMaterial extends MeshPhongMaterial {
  constructor(o) { super(); this.type = 'MeshStandardMaterial'; if (o) this.setValues(o); }
}
export class LineBasicMaterial extends Material {
  constructor(o) { super(); this.type = 'LineBasicMaterial'; this.linewidth = 1; if (o) this.setValues(o); }
}
export class PointsMaterial extends Material {
  constructor(o) { super(); this.type = 'PointsMaterial'; this.size = 1; this.map = null; this.alphaTest = 0; if (o) this.setValues(o); }
}
export class SpriteMaterial extends Material {
  constructor(o) { super(); this.type = 'SpriteMaterial'; this.map = null; this.rotation = 0; if (o) this.setValues(o); }
}
export class ShaderMaterial extends Material {
  constructor(o) {
    super();
    this.type = 'ShaderMaterial';
    this.uniforms = {};
    this.vertexShader = '';
    this.fragmentShader = '';
    this.defines = {};
    if (o) this.setValues(o);
  }
}
export class RawShaderMaterial extends ShaderMaterial {}

let texId = 0;
export class Texture {
  constructor(image) {
    this.id = texId++;
    this.uuid = 'tex' + this.id;
    this.image = image || { width: 1, height: 1, data: null };
    this.wrapS = ClampToEdgeWrapping;
    this.wrapT = ClampToEdgeWrapping;
    this.magFilter = LinearFilter;
    this.minFilter = LinearMipmapLinearFilter;
    this.generateMipmaps = true;
    this.flipY = true;
    this.colorSpace = NoColorSpace;
    this.needsUpdate = false;
    this.repeat = new Vector2(1, 1);
    this.offset = new Vector2(0, 0);
    this.isTexture = true;
  }
  dispose() {}
  clone() { return new Texture(this.image); }
}
export class CanvasTexture extends Texture {}
export class DataTexture extends Texture {
  constructor(data, width, height, format, type) {
    super({ data, width, height });
    this.format = format;
    this.type = type;
    this.magFilter = NearestFilter;
    this.minFilter = NearestFilter;
    this.generateMipmaps = false;
    this.flipY = false;
    this.isDataTexture = true;
  }
}
export class DepthTexture extends Texture {}
export class WebGLRenderTarget {
  constructor(width = 1, height = 1, opts = {}) {
    this.width = width; this.height = height;
    this.texture = new Texture();
    this.depthTexture = opts.depthTexture || null;
    this.samples = 0;
  }
  setSize(w, h) { this.width = w; this.height = h; }
  dispose() {}
}

/* --- Kameras und Licht (Huellen) ----------------------------------------- */
export class Camera extends Object3D {
  constructor() {
    super();
    this.type = 'Camera';
    this.matrixWorldInverse = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.projectionMatrixInverse = new Matrix4();
    this.isCamera = true;
  }
}
export class PerspectiveCamera extends Camera {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    super();
    this.type = 'PerspectiveCamera';
    this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
    this.zoom = 1;
    this.isPerspectiveCamera = true;
  }
  updateProjectionMatrix() {}
}
export class OrthographicCamera extends Camera {
  constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2000) {
    super();
    this.type = 'OrthographicCamera';
    this.left = left; this.right = right; this.top = top; this.bottom = bottom;
    this.near = near; this.far = far;
    this.isOrthographicCamera = true;
  }
  updateProjectionMatrix() {}
}
export class Light extends Object3D {
  constructor(color, intensity = 1) {
    super();
    this.type = 'Light';
    this.color = new Color(color === undefined ? 0xffffff : color);
    this.intensity = intensity;
    this.isLight = true;
  }
}
export class HemisphereLight extends Light {
  constructor(sky, ground, intensity) {
    super(sky, intensity);
    this.type = 'HemisphereLight';
    this.groundColor = new Color(ground === undefined ? 0xffffff : ground);
  }
}
export class DirectionalLight extends Light {
  constructor(color, intensity) {
    super(color, intensity);
    this.type = 'DirectionalLight';
    this.target = new Object3D();
    this.shadow = {
      mapSize: new Vector2(512, 512),
      camera: new OrthographicCamera(),
      bias: 0, normalBias: 0, radius: 1,
      map: null
    };
  }
}
export class AmbientLight extends Light {}
export class Raycaster {
  constructor() { this.ray = { origin: new Vector3(), direction: new Vector3() }; this.params = {}; }
  setFromCamera() {}
  intersectObject() { return []; }
  intersectObjects() { return []; }
}
export class WebGLRenderer {
  constructor() {
    this.domElement = { width: 1, height: 1, style: {}, addEventListener() {}, getContext() { return null; } };
    this.shadowMap = { enabled: false, type: 0 };
    this.info = { render: { calls: 0, triangles: 0 }, memory: {} };
    this.capabilities = { isWebGL2: true, maxTextureSize: 4096, getMaxAnisotropy() { return 1; } };
    this.outputColorSpace = SRGBColorSpace;
    this.toneMapping = NoToneMapping;
    this.toneMappingExposure = 1;
  }
  setSize() {} setPixelRatio() {} setClearColor() {} render() {} dispose() {}
  getPixelRatio() { return 1; }
  setRenderTarget() {} clear() {} getContext() { return null; }
  compile() {}
}

/* Shaderbausteine: bewusst LEER. Die Ankerpruefung (Ebene 4) laeuft gegen die
   gepinnte Three-Quelle, nicht gegen diesen Ersatz — ein selbst geschriebener
   Chunk-Text wuerde genau den Fehler verstecken, den sie finden soll. */
export const ShaderChunk = {};
export const ShaderLib = {};
export const UniformsUtils = {
  clone(u) { return JSON.parse(JSON.stringify(u)); },
  merge(list) { return Object.assign({}, ...list); }
};
export const UniformsLib = {};
export const MathUtils = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  degToRad: (d) => d * Math.PI / 180,
  radToDeg: (r) => r * 180 / Math.PI,
  euclideanModulo: (n, m) => ((n % m) + m) % m,
  generateUUID: (() => { let n = 0; return () => 'uuid' + (n++); })()
};
