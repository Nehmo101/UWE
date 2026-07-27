// Rechtes Panel, Werkzeugleiste, Hinweiszeile, Toast und Statusanzeige.
import { S } from '../core/store.js';
import { instanceTotal, schattenAnzahl } from '../core/pools.js';
import { ed, TOOLS, VARIANTS, PARAMS, schemaKey, defaultsFor, toolParams, setTool }
  from '../editor/tools.js';
import { commit, isHeavy, deleteElement } from '../core/dirty.js';
import { pushUndo } from '../editor/history.js';
import { rebuildHandles } from '../editor/selection.js';
import { getRenderInfo } from '../render/pipeline.js';

var panelEl = null;
export function initPanels() { panelEl = document.getElementById("panel"); }

function el(tag, cls, txt) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt !== undefined) n.textContent = txt;
  return n;
}

function buildRail() {
  var rail = document.getElementById("rail");
  rail.innerHTML = "";
  for (var i = 0; i < TOOLS.length; i++) {
    (function (t) {
      var b = el("div", "tool card" + (t.id === ed.tool ? " on" : ""));
      b.dataset.id = t.id;
      b.appendChild(el("div", "g", t.g));
      b.appendChild(el("div", "l", t.l));
      b.appendChild(el("div", "k", t.key));
      b.title = t.l + "  (" + t.key + ")";
      b.addEventListener("click", function () { setTool(t.id); });
      rail.appendChild(b);
    })(TOOLS[i]);
  }
}

/** Erzeugt eine Zeile für einen Parameter und bindet sie an das Zielobjekt. */
function paramRow(def, obj, apply) {
  var row = el("div", "row");
  if (def.b) {
    var lab = el("label", "chk");
    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = !!obj[def.k];
    cb.addEventListener("change", function () { apply(true); obj[def.k] = cb.checked; apply(); });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, def.l));
    row.appendChild(lab);
    return row;
  }
  if (def.o) {
    var l2 = el("label");
    l2.appendChild(el("span", null, def.l));
    row.appendChild(l2);
    var sel = el("select");
    for (var i = 0; i < def.o.length; i++) {
      var op = el("option", null, def.o[i][1]);
      op.value = def.o[i][0];
      sel.appendChild(op);
    }
    sel.value = obj[def.k];
    sel.addEventListener("change", function () { apply(true); obj[def.k] = sel.value; apply(); });
    row.appendChild(sel);
    return row;
  }
  var lab2 = el("label");
  lab2.appendChild(el("span", null, def.l));
  var val = el("b", null, String(obj[def.k]));
  lab2.appendChild(val);
  row.appendChild(lab2);
  var inp = el("input");
  inp.type = "range";
  inp.min = def.min; inp.max = def.max; inp.step = def.st;
  inp.value = obj[def.k];
  var undoDone = false;
  inp.addEventListener("input", function () {
    if (!undoDone) { apply(true); undoDone = true; }
    obj[def.k] = parseFloat(inp.value);
    val.textContent = inp.value;
    apply();
  });
  inp.addEventListener("change", function () { undoDone = false; });
  row.appendChild(inp);
  return row;
}

function buildPanel() {
  panelEl.innerHTML = "";
  var target = ed.selected;
  var kind = target ? target.kind : ed.tool;
  var variant = target ? target.variant : ed.variantOf[ed.tool];
  var obj = target ? target.params : toolParams[ed.tool + ":" + ed.variantOf[ed.tool]];

  if (kind === "auswahl" && !target) {
    panelEl.appendChild(el("div", "ph", "Auswahl"));
    panelEl.appendChild(el("div", "psub",
      "Auf ein Element klicken, um seine Punkte und Parameter zu bearbeiten. " +
      "Entf löscht das ausgewählte Element."));
    panelEl.appendChild(el("div", "psub", S.elements.length + " Elemente auf der Karte."));
    return;
  }
  var head = target
    ? "Element · " + kind
    : (TOOLS.filter(function (t) { return t.id === ed.tool; })[0] || { l: ed.tool }).l;
  panelEl.appendChild(el("div", "ph", head));

  // Varianten
  if (VARIANTS[kind] && VARIANTS[kind].length > 1) {
    var seg = el("div", "seg");
    for (var i = 0; i < VARIANTS[kind].length; i++) {
      (function (v) {
        var b = el("button", v[0] === variant ? "on" : "", v[1]);
        b.addEventListener("click", function () {
          if (target) {
            pushUndo();
            target.variant = v[0];
            var nd = defaultsFor(target.kind, v[0]);
            for (var k in nd) if (target.params[k] === undefined) target.params[k] = nd[k];
            commit(target, true);
          } else {
            ed.variantOf[kind] = v[0];
            if (ed.draw) ed.draw.variant = v[0];
          }
          buildPanel();
          updateHint();
        });
        seg.appendChild(b);
      })(VARIANTS[kind][i]);
    }
    var wrap = el("div", "row");
    wrap.appendChild(seg);
    panelEl.appendChild(wrap);
  }

  // Parameter
  var defs = PARAMS[schemaKey(kind, variant)] || [];
  var applyFn = function (isUndoPoint) {
    if (isUndoPoint === true) { if (target) pushUndo(); return; }
    if (target) commit(target, isHeavy(target));
  };
  for (var d = 0; d < defs.length; d++) {
    if (obj[defs[d].k] === undefined) obj[defs[d].k] = defs[d].d;
    panelEl.appendChild(paramRow(defs[d], obj, applyFn));
  }

  if (target) {
    panelEl.appendChild(el("hr"));
    var reroll = el("button", "btn", "🎲  Neu würfeln");
    reroll.addEventListener("click", function () {
      pushUndo();
      target.seed = (target.seed + 0x9e3779b9) | 0;
      commit(target, isHeavy(target));
      toast("Bestückung neu gewürfelt");
    });
    panelEl.appendChild(reroll);
    var del = el("button", "btn warn", "Löschen  (Entf)");
    del.addEventListener("click", function () {
      pushUndo();
      var heavy = isHeavy(target);
      deleteElement(target);
      ed.selected = null;
      rebuildHandles();
      commit(null, heavy);
      buildPanel();
    });
    panelEl.appendChild(del);
    panelEl.appendChild(el("div", "psub", "Punkte ziehen verändert die Form — die Bestückung " +
      "wird dabei neu erzeugt."));
  } else if (kind === "terrain") {
    panelEl.appendChild(el("div", "psub", "Ziehen verformt das Terrain. „Einebnen“ nimmt die Höhe " +
      "des ersten Klicks als Ziel."));
  } else if (kind === "pfad" || kind === "flaeche") {
    panelEl.appendChild(el("div", "psub", "Klicken setzt Punkte, Doppelklick oder Enter schließt ab, " +
      "Esc bricht ab."));
  }
}

function updateHint() {
  var h = document.getElementById("hint");
  var txt;
  if (ed.draw) txt = "<b>" + ed.draw.points.length + (ed.draw.points.length === 1 ? " Punkt" : " Punkte") +
    "</b> — Doppelklick oder <b>Enter</b> beendet, <b>Esc</b> bricht ab";
  else if (ed.tool === "pfad") txt = "<b>Pfad</b> zeichnen: klicken, Doppelklick beendet";
  else if (ed.tool === "flaeche") txt = "<b>Fläche</b> zeichnen: klicken, Doppelklick schließt das Polygon";
  else if (ed.tool === "objekt") txt = "<b>Klicken</b> platziert, <b>Ziehen</b> streut";
  else if (ed.tool === "ranke") txt = "<b>Klicken</b> pflanzt eine Ranke";
  else if (ed.tool === "terrain") txt = "<b>Ziehen</b> formt das Terrain";
  else txt = "<b>Klick</b> wählt aus · Griffe ziehen · <b>Entf</b> löscht";
  h.innerHTML = txt + "<br>WASD bewegen · Q/E drehen · Rad zoomen · Rechte Maus schwenken";
}

var toastT = 0;
function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  toastT = performance.now() + 1600;
}

function updateStats(fps) {
  var info = getRenderInfo();
  document.getElementById("stats").innerHTML =
    Math.round(fps) + " <span>fps</span> &nbsp; " +
    info.calls + " <span>calls</span> &nbsp; " +
    (info.triangles > 99999 ? Math.round(info.triangles / 1000) + "k"
      : info.triangles.toLocaleString("de-DE")) + " <span>tris</span> &nbsp; " +
    (instanceTotal + schattenAnzahl).toLocaleString("de-DE") + " <span>Instanzen</span> &nbsp; " +
    S.elements.length + " <span>Elemente</span>";
}


/** Toast-Timer, von der Renderschleife bedient. */
function tickToast(now) {
  if (toastT && now > toastT) {
    document.getElementById("toast").classList.remove("show");
    toastT = 0;
  }
}

export { el, buildRail, paramRow, buildPanel, updateHint, toast, tickToast, updateStats };
