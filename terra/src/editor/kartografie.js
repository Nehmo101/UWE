/* Reine Kartografie-Logik ohne DOM oder Three.js. Die rechenintensive
   Draufsicht bleibt dadurch testbar und kann spaeter in einen Worker. */

export const ATLAS_STILE = {
  gemalt: {
    label: "Rot & Graphit",
    papier: [247, 244, 232], land: [242, 239, 223], wasser: [246, 244, 236],
    papierCss: "#f7f4e8", tinte: "#302e2a", akzent: "#a33d31", faser: "rgba(74, 61, 44,"
  },
  pergament: {
    label: "Sepia & Zinnober",
    papier: [237, 225, 193], land: [232, 219, 184], wasser: [237, 226, 201],
    papierCss: "#ede1c1", tinte: "#493c2f", akzent: "#a8472f", faser: "rgba(90, 62, 36,"
  },
  tinte: {
    label: "Reine Tinte",
    papier: [250, 249, 244], land: [247, 246, 240], wasser: [250, 249, 245],
    papierCss: "#faf9f4", tinte: "#292929", akzent: "#292929", faser: "rgba(52, 52, 48,"
  }
};

export const ATLAS_STANDARD = "pergament";

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function mix(a, b, t) { return Math.round(a + (b - a) * t); }
function hash2(x, y, seed) {
  var n = Math.imul((x | 0) ^ seed, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function atlasFarbe(hoehe, hang, stil, x, y, seed) {
  var p = ATLAS_STILE[stil] || ATLAS_STILE.gemalt;
  var t = clamp((hoehe - 1) / 24, 0, 1) * .38 + clamp(hang / 9, 0, .18);
  var basis = [mix(p.papier[0], p.land[0], t), mix(p.papier[1], p.land[1], t),
    mix(p.papier[2], p.land[2], t)];
  var wasch = (hash2(x >> 5, y >> 5, seed) - 0.5) * 3;
  var korn = (hash2(x, y, seed + 91) - 0.5) * 2.4;
  return basis.map(function (v) { return clamp(Math.round(v + wasch + korn), 0, 255); });
}

export function wasserFarbe(hoehe, stil, x, y, seed) {
  var p = ATLAS_STILE[stil] || ATLAS_STILE.gemalt;
  var wasch = (hash2(x >> 5, y >> 5, seed + 37) - 0.5) * 2.6;
  var korn = (hash2(x, y, seed + 7) - 0.5) * 1.8;
  return p.wasser.map(function (v) { return clamp(Math.round(v + wasch + korn), 0, 255); });
}

export function hoehenIndex(px, py, breite, hoehe, vw) {
  var ix = clamp(Math.round(px / Math.max(1, breite - 1) * (vw - 1)), 0, vw - 1);
  var iz = clamp(Math.round(py / Math.max(1, hoehe - 1) * (vw - 1)), 0, vw - 1);
  return iz * vw + ix;
}

export function hoeheInterpoliert(feld, vw, px, py, breite, hoehe) {
  var gx = clamp(px / Math.max(1, breite - 1) * (vw - 1), 0, vw - 1);
  var gy = clamp(py / Math.max(1, hoehe - 1) * (vw - 1), 0, vw - 1);
  var x0 = Math.floor(gx), y0 = Math.floor(gy);
  var x1 = Math.min(vw - 1, x0 + 1), y1 = Math.min(vw - 1, y0 + 1);
  var tx = gx - x0, ty = gy - y0;
  var a = feld[y0 * vw + x0] * (1 - tx) + feld[y0 * vw + x1] * tx;
  var b = feld[y1 * vw + x0] * (1 - tx) + feld[y1 * vw + x1] * tx;
  return a * (1 - ty) + b * ty;
}

function schnitt(a, b, ax, ay, bx, by, niveau) {
  var t = (niveau - a) / ((b - a) || 1e-9);
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

function niveauPfad(ctx, feld, vw, breite, hoehe, niveau) {
  var sx = breite / (vw - 1), sy = hoehe / (vw - 1);
  ctx.beginPath();
  for (var j = 0; j < vw - 1; j++) for (var i = 0; i < vw - 1; i++) {
    var x = i * sx, y = j * sy;
    var tl = feld[j * vw + i], tr = feld[j * vw + i + 1];
    var br = feld[(j + 1) * vw + i + 1], bl = feld[(j + 1) * vw + i];
    var p = [];
    if ((tl >= niveau) !== (tr >= niveau)) p.push(schnitt(tl, tr, x, y, x + sx, y, niveau));
    if ((tr >= niveau) !== (br >= niveau)) p.push(schnitt(tr, br, x + sx, y, x + sx, y + sy, niveau));
    if ((br >= niveau) !== (bl >= niveau)) p.push(schnitt(br, bl, x + sx, y + sy, x, y + sy, niveau));
    if ((bl >= niveau) !== (tl >= niveau)) p.push(schnitt(bl, tl, x, y + sy, x, y, niveau));
    if (p.length === 2) {
      ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y);
    } else if (p.length === 4) {
      ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y);
      ctx.moveTo(p[2].x, p[2].y); ctx.lineTo(p[3].x, p[3].y);
    }
  }
}

export function weltZuAtlas(x, z, breite, hoehe, half) {
  return { x: (x + half) / (half * 2) * breite, y: (z + half) / (half * 2) * hoehe };
}

export function konturLinien(ctx, feld, vw, breite, hoehe, schritt) {
  schritt = Math.max(2, schritt || 5);
  ctx.save(); ctx.strokeStyle = "rgba(65, 57, 43, .18)";
  ctx.lineWidth = Math.max(0.55, breite / 1600);
  var zelleX = breite / (vw - 1), zelleY = hoehe / (vw - 1);
  ctx.beginPath();
  // Kurze Marching-Squares-Segmente wirken gedruckt wie gezeichnete Isohypsen.
  for (var j = 1; j < vw; j++) {
    for (var i = 1; i < vw; i++) {
      var h = feld[j * vw + i], l = feld[j * vw + i - 1], o = feld[(j - 1) * vw + i];
      if (Math.floor(h / schritt) !== Math.floor(l / schritt)) {
        ctx.moveTo(i * zelleX, (j - 1) * zelleY); ctx.lineTo(i * zelleX, j * zelleY);
      }
      if (Math.floor(h / schritt) !== Math.floor(o / schritt)) {
        ctx.moveTo((i - 1) * zelleX, j * zelleY); ctx.lineTo(i * zelleX, j * zelleY);
      }
    }
  }
  ctx.stroke(); ctx.restore();
}
export function kuestenLinien(ctx, feld, vw, breite, hoehe) {
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
  var stufen = [-9, -6, -3.5, -1.5];
  for (var i = 0; i < stufen.length; i++) {
    niveauPfad(ctx, feld, vw, breite, hoehe, stufen[i]);
    ctx.strokeStyle = "rgba(48, 46, 42, " + (.18 + i * .06) + ")";
    ctx.lineWidth = Math.max(.55, breite / 1900); ctx.stroke();
  }
  niveauPfad(ctx, feld, vw, breite, hoehe, 0);
  ctx.strokeStyle = "rgba(42, 40, 37, .92)";
  ctx.lineWidth = Math.max(1.05, breite / 850); ctx.stroke();
  ctx.restore();
}



export function atlasTitel(name) {
  var sauber = String(name || "").trim();
  return sauber || "Unbenannte Terra-Karte";
}
