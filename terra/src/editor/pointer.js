// Zeigereingabe: Zeichnen, Griffe, Pinsel, Orbit/Pan/Zoom — und die Tastatur.
// Mausbewegungen schreiben nur Koordinaten; die Terrain-Strahl-Auswertung laeuft
// gedrosselt auf 30 Hz in der Renderschleife (verarbeiteZeiger).
import { clamp, DEG } from '../core/rng.js';
import { S, HALF, mkElement, nextSeed } from '../core/store.js';
import { applyBrush, baseHeightAt, setFlattenTarget } from '../world/terrain.js';
import { cam, groundPoint, rayFrom, rayPlane, autoPitch } from './camera.js';
import { ed, setTool, finishDraw, cancelDraw, curParams, copyParams, snapPt, TOOLS }
  from './tools.js';
import { handles, rebuildHandles, updateHandlePositions, setPreview, updateBrushRing,
  brushRing, pickElement, select, naechstesSegment, aktiverGriff, setAktiverGriff,
  zugGriffIndex, zugGriffElement, zugpunktListe, rankeAchsenTreffer, zugPixelProHoehe }
  from './selection.js';
import { raycaster, _ndc, camera } from './camera.js';
import { regenElement, regenAlleElemente, commit, isHeavy, deleteElement } from '../core/dirty.js';
import { rankePlatzierbar, rankeAchse, rankeKernPunkt } from '../generators/vines.js';
import { pushUndo, undo, redo } from './history.js';
import { toast, buildPanel, updateHint } from '../ui/panels.js';

var ptr = { down: false, mode: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, handle: -1,
            grab: null, lastClick: 0, lastCx: -999, lastCy: -999, lastX: 0, lastZ: 0,
            dragged: false, zug: null };
var hoverPoint = null;
var zeigerOffen = false, zeigerX = 0, zeigerY = 0, zeigerZuletzt = 0;
// Umschalttaste zum letzten Mausereignis — aus dem Event selbst statt aus dem
// globalen keys-Objekt, damit der Modus auch dann stimmt, wenn der Fokus
// zwischendurch im Panel lag.
var zeigerShift = false;
var _zeigerEv = { clientX: 0, clientY: 0 };
// Arbeitspunkte fuer die Zugpunkt-Bearbeitung (Achspunkt mit / ohne Zuganteil)
var _zpA = { x: 0, y: 0, z: 0 }, _zpB = { x: 0, y: 0, z: 0 };

export function initPointer(cv) {
  cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  window.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  cv.addEventListener("pointerdown", function (e) {
    cv.setPointerCapture(e.pointerId);
    ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY;
    ptr.sx = e.clientX; ptr.sy = e.clientY; ptr.moved = 0; ptr.dragged = false;
    var p = groundPoint(e);
    if (e.button === 2) {
      ptr.mode = "pan";
      ptr.grab = p ? { x: p.x, y: p.y, z: p.z } : { x: cam.focus.x, y: cam.focusY, z: cam.focus.z };
      return;
    }
    if (e.button === 1) { ptr.mode = "orbit"; return; }
    if (e.button !== 0) return;

    // Griff anfassen?
    if ((ed.selected || ed.draw) && handles.children.length) {
      raycaster.setFromCamera(_ndc, camera);
      var hits = raycaster.intersectObjects(handles.children, false);
      if (hits.length) {
        ptr.mode = "handle";
        ptr.handle = hits[0].object.userData.idx;
        ptr.zug = null;
        if (!ed.draw) {
          pushUndo();
          setAktiverGriff(ptr.handle);   // Griff bleibt nach dem Loslassen "aktiv" (Entf loescht ihn)
          // H4.2: Zugpunkt-Griff? Der zieht nicht ueber den Boden, sondern in
          // einer waagerechten Ebene auf Griffhoehe (bzw. mit Shift in der
          // Hoehe). Startwerte hier merken, damit das Ziehen absolut bleibt
          // und nicht Frame fuer Frame aufaddiert.
          var zIdx = zugGriffIndex(ptr.handle), zEl = zugGriffElement();
          var zListe = zEl ? zugpunktListe(zEl) : null;
          if (zIdx >= 0 && zListe && zListe[zIdx]) {
            ptr.zug = { el: zEl, idx: zIdx, startH: zListe[zIdx].h,
                        startY: e.clientY, pxProH: zugPixelProHoehe(zEl) };
          }
        }
        return;
      }
    }
    if (!p) return;
    if (ed.tool === "terrain") {
      ptr.mode = "brush";
      pushUndo();
      setFlattenTarget(baseHeightAt(p.x, p.z));
      applyBrush(p, ed.variantOf.terrain, curParams().radius, curParams().staerke, 1 / 60);
      return;
    }
    if (ed.tool === "objekt") {
      ptr.mode = "scatter";
      pushUndo();
      var sp = snapPt(p);
      var el = mkElement("objekt", ed.variantOf.objekt, [sp], copyParams(curParams()), nextSeed());
      S.elements.push(el);
      regenElement(el);
      ptr.scatterEl = el;
      ptr.lastX = sp.x; ptr.lastZ = sp.z;
      select(el);
      return;
    }
    if (ed.tool === "ranke") {
      // Nur beim Erzeugen pruefen — bestehende Karten mit Wasser-Ranken
      // muessen weiter rendern, deshalb sitzt die Regel nicht in genRanke.
      var rsp = snapPt(p);
      if (!rankePlatzierbar(rsp.x, rsp.z)) {
        toast("Ranke braucht festen, flachen Grund");
        return;
      }
      /* H4.4: Alt + Klick waechst einen weiteren Fuss an die AUSGEWAEHLTE
         Ranke an, statt eine neue zu pflanzen. Alt ist hier der klarste
         Mechanismus: das Rankenwerkzeug kennt nur diese eine Geste, ein
         Panel-Knopf schiede aus (panels.js ist in dieser Runde tabu) und
         eine eigene Variante ("Fuss anfuegen") waere ein Moduswechsel, den
         man beim naechsten Klick vergisst. Dieselbe Platzierungsregel gilt,
         der Zweig steht deshalb NACH der Pruefung. */
      if (e.altKey && ed.selected && ed.selected.kind === "ranke") {
        pushUndo();
        ed.selected.points.push(rsp);
        rebuildHandles();
        commit(ed.selected, isHeavy(ed.selected));
        toast("Fußpunkt angewachsen (" + ed.selected.points.length + " Füße)");
        ptr.mode = "done";
        return;
      }
      pushUndo();
      var rel = mkElement("ranke", "ranke", [rsp], copyParams(curParams()), nextSeed());
      S.elements.push(rel);
      // commit statt regenElement: bei Ranken haengt an einem Commit mehr als
      // die Geometrie (dirty.js zieht die Arbor-Lichtquellen nach). isHeavy
      // ist fuer Ranken false, der Weg bleibt also der leichte.
      commit(rel, isHeavy(rel));
      select(rel);
      ptr.mode = "done";
      return;
    }
  });

  cv.addEventListener("pointermove", function (e) {
    var dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    ptr.x = e.clientX; ptr.y = e.clientY;
    ptr.moved += Math.abs(dx) + Math.abs(dy);
    if (ptr.moved > 6) ptr.dragged = true;

    if (ptr.mode === "orbit") {                    // billig, sofort auswerten
      cam.tYaw -= dx * 0.006;
      cam.tPitch = clamp(cam.tPitch + dy * 0.004, 22 * DEG, 68 * DEG);
      return;
    }
    if (ptr.mode === "pan" && ptr.grab) {          // nur Ebenenschnitt, kein Terrain
      var pp = rayPlane(rayFrom(e), ptr.grab.y);
      if (pp) {
        cam.tFocus.x = clamp(cam.tFocus.x + (ptr.grab.x - pp.x), -HALF - 40, HALF + 40);
        cam.tFocus.z = clamp(cam.tFocus.z + (ptr.grab.z - pp.z), -HALF - 40, HALF + 40);
      }
      return;
    }
    zeigerOffen = true; zeigerX = e.clientX; zeigerY = e.clientY;
    zeigerShift = e.shiftKey;
  });


  cv.addEventListener("pointerup", function (e) {
    var wasMode = ptr.mode, dragged = ptr.dragged;
    ptr.down = false; ptr.mode = null; ptr.grab = null;
    if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    if (wasMode === "brush") {
      // Einmalig beim Loslassen: alle Elemente auf die neue Terrainhöhe setzen
      // (Bäume/Häuser schweben sonst bzw. versinken, Kontaktschatten veralten).
      regenAlleElemente();
      toast("Terrain geändert");
      return;
    }
    if (wasMode === "handle") {
      ptr.zug = null;
      if (ed.selected) commit(ed.selected, isHeavy(ed.selected));
      return;
    }
    if (wasMode === "scatter") { ptr.scatterEl = null; return; }
    if (wasMode === "pan" || wasMode === "orbit" || wasMode === "done") return;
    if (e.button !== 0 || dragged) return;

    var now = performance.now();
    // Doppelklick nur, wenn beide Klicks auch am selben Fleck sitzen —
    // sonst beendet schnelles Setzen zweier Punkte versehentlich die Zeichnung.
    var isDouble = (now - ptr.lastClick) < 340 &&
      Math.abs(e.clientX - ptr.lastCx) + Math.abs(e.clientY - ptr.lastCy) < 10;
    ptr.lastClick = now; ptr.lastCx = e.clientX; ptr.lastCy = e.clientY;

    /* H4.2: Doppelklick auf die Rankenachse setzt dort einen Zugpunkt. Der
       Zweig steht bewusst VOR der Bodenpunkt-Pruefung: ein Klick weit oben am
       Stamm trifft in aller Regel keinen Boden mehr (groundPoint liefert dann
       null, und der Strahl zeigt womoeglich ueber den Horizont). Die
       Punkt-Einfuegen-Logik fuer pfad/flaeche (Runde E) bleibt unangetastet —
       sie sitzt unveraendert weiter unten und greift nur fuer ihre Kinds. */
    if (isDouble && !ed.draw && ed.tool === "auswahl" && ed.selected &&
        ed.selected.kind === "ranke") {
      // Toleranz bestimmt selection.js aus VINE_R und der Rankendicke
      var th = rankeAchsenTreffer(ed.selected, e);
      if (th > 0.02 && th < 0.99) {
        pushUndo();
        var zEl2 = ed.selected;
        if (!Array.isArray(zEl2.params.zugpunkte)) zEl2.params.zugpunkte = [];
        // Der neue Punkt sitzt exakt auf der heutigen Achse (dx/dz = aktuelle
        // Auslenkung an dieser Hoehe) — das Einfuegen aendert die Form also
        // nicht, es macht sie nur greifbar.
        rankeAchse(zEl2, th, _zpA);
        rankeKernPunkt(zEl2, th, _zpB);
        var zListe2 = zEl2.params.zugpunkte, zPos = 0;
        while (zPos < zListe2.length && zListe2[zPos].h < th) zPos++;
        zListe2.splice(zPos, 0, { h: th, dx: _zpA.x - _zpB.x, dz: _zpA.z - _zpB.z });
        rebuildHandles();
        setAktiverGriff(zEl2.points.length + zPos);
        commit(zEl2, isHeavy(zEl2));
        toast("Zugpunkt gesetzt — ziehen verschiebt, mit Shift die Höhe");
        return;
      }
    }

    var p = groundPoint(e);
    if (!p) return;

    if (ed.tool === "auswahl") {
      // Doppelklick auf ein Segment des ausgewaehlten Elements: Punkt einfuegen.
      // Nur pfad/flaeche — objekt-Punkte sind Streuzentren ohne Segmentsemantik
      // (ein "Segment" zwischen zwei Streupunkten existiert visuell nicht), und
      // die Fusspunkte einer Ranke (seit H4.4 mehrere) spannen ebenfalls kein
      // Segment auf: dort setzt der Doppelklick oben einen Zugpunkt auf die
      // Achse. Greift nur ohne aktive Zeichnung, damit die
      // Doppelklick-Semantik "Zeichnen beenden" unberuehrt bleibt.
      if (isDouble && !ed.draw && ed.selected &&
          (ed.selected.kind === "pfad" || ed.selected.kind === "flaeche") &&
          ed.selected.points.length >= 2) {
        // Toleranz wie in pickElement: halbe Pfadbreite plus Griffradius
        var tol = ed.selected.kind === "pfad"
          ? (ed.selected.params.breite || ed.selected.params.dicke || 3) * 0.5 + 3.5
          : 3.5;
        var seg = naechstesSegment(ed.selected, p.x, p.z, tol);
        if (seg) {
          pushUndo();
          var np = snapPt({ x: seg.px, z: seg.pz });
          ed.selected.points.splice(seg.index + 1, 0, np);
          rebuildHandles();
          setAktiverGriff(seg.index + 1);   // neuer Punkt ist gleich der aktive Griff
          commit(ed.selected, isHeavy(ed.selected));
          toast("Punkt eingefügt");
          return;
        }
      }
      select(pickElement(e, p));
      return;
    }
    if (ed.tool === "pfad" || ed.tool === "flaeche") {
      if (isDouble) { finishDraw(); return; }
      if (!ed.draw) ed.draw = { kind: ed.tool, variant: ed.variantOf[ed.tool], points: [] };
      ed.draw.points.push(snapPt(p));
      rebuildHandles();
      setPreview(ed.draw.points, null, ed.tool === "flaeche");
      updateHint();
    }
  });

  cv.addEventListener("dblclick", function () {
    if (!ed.draw) return;
    // Zwillingspunkt des Doppelklicks entfernen, falls die Zeitschwelle nicht griff
    var n = ed.draw.points.length;
    if (n >= 2) {
      var a = ed.draw.points[n - 1], b = ed.draw.points[n - 2];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 2.5) ed.draw.points.pop();
    }
    finishDraw();
  });

  cv.addEventListener("wheel", function (e) {
    e.preventDefault();
    cam.tDist = clamp(cam.tDist * Math.exp(e.deltaY * 0.0012), 25, 400);
    cam.tPitch = autoPitch();
  }, { passive: false });
}

/** Ausgelagerte Auswertung der Mausposition, höchstens alle 33 ms. */
function verarbeiteZeiger(now) {
  if (!zeigerOffen || now - zeigerZuletzt < 33) return;
  zeigerZuletzt = now; zeigerOffen = false;
  _zeigerEv.clientX = zeigerX; _zeigerEv.clientY = zeigerY;
  var p = groundPoint(_zeigerEv);
  hoverPoint = p;

  if (ptr.mode === "brush" && p) {
    applyBrush(p, ed.variantOf.terrain, curParams().radius, curParams().staerke, 1 / 60);
    updateBrushRing(p, curParams().radius);
    return;
  }
  /* H4.2: Zugpunkt ziehen. Eigener Zweig VOR dem Bodengriff-Zweig, weil er
     keinen Bodenpunkt braucht (und oben am Stamm auch keinen bekommt):
     ohne Shift schneidet der Mausstrahl eine WAAGERECHTE Ebene auf
     Griffhoehe (rayPlane aus camera.js), mit Shift verschiebt die
     senkrechte Mausbewegung stattdessen die relative Hoehe h. Vorschau
     ueber regenElement, der Commit kommt beim Loslassen (pointerup). */
  if (ptr.mode === "handle" && ptr.zug) {
    var zg = ptr.zug, zL = zugpunktListe(zg.el), zP = zL && zL[zg.idx];
    if (zP) {
      if (zeigerShift) {
        zP.h = clamp(zg.startH + (zg.startY - zeigerY) / zg.pxProH, 0.02, 0.98);
      } else {
        rankeAchse(zg.el, zP.h, _zpA);
        var zPl = rayPlane(rayFrom(_zeigerEv), _zpA.y);
        if (zPl) {
          rankeKernPunkt(zg.el, zP.h, _zpB);
          zP.dx = zPl.x - _zpB.x;
          zP.dz = zPl.z - _zpB.z;
        }
      }
      updateHandlePositions();
      regenElement(zg.el);
    }
    return;
  }
  if (ptr.mode === "handle" && p) {
    var list = ed.draw ? ed.draw.points : (ed.selected ? ed.selected.points : null);
    if (list && list[ptr.handle]) {
      var sp = snapPt(p);
      list[ptr.handle].x = sp.x; list[ptr.handle].z = sp.z;
      updateHandlePositions();
      if (ed.draw) setPreview(ed.draw.points, null, ed.draw.kind === "flaeche");
      else {
        // Viertel cachen ihr Gassennetz in el.streets (genViertel baut nur bei
        // null neu); das Netz haengt aber ueber Zentrum/Ausdehnung von den
        // Punkten ab. Ohne Invalidierung klebten Gassen und Haeuser waehrend
        // des Zugs an der alten Form und spraengen erst beim pointerup-Commit
        // um (dort baut rebuildCorridors das Netz ohnehin neu — clearElement
        // nullt streets NICHT, sonst waere der Cache wirkungslos). Kostet
        // districtStreets pro Drag-Frame; das ist die einzige Stelle, an der
        // sich die Punkte ohne schweren Commit aendern.
        if (ed.selected.kind === "flaeche" && ed.selected.variant === "viertel")
          ed.selected.streets = null;
        regenElement(ed.selected);
      }
    }
    return;
  }
  if (ptr.mode === "scatter" && p && ptr.scatterEl) {
    var d = Math.hypot(p.x - ptr.lastX, p.z - ptr.lastZ);
    if (d > Math.max(2.5, ptr.scatterEl.params.streuung * 0.8)) {
      var sp2 = snapPt(p);
      ptr.scatterEl.points.push(sp2);
      ptr.lastX = sp2.x; ptr.lastZ = sp2.z;
      regenElement(ptr.scatterEl);
    }
    return;
  }
  if (ed.tool === "terrain") updateBrushRing(p, curParams().radius);
  else brushRing.visible = false;
  if (ed.draw && p) setPreview(ed.draw.points, snapPt(p), ed.draw.kind === "flaeche");
}

function onKey(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.code === "KeyZ" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) { e.preventDefault(); redo(); return; }
    return;
  }
  for (var i = 0; i < TOOLS.length; i++) {
    if (e.code === "Digit" + TOOLS[i].key || e.code === "Numpad" + TOOLS[i].key) {
      setTool(TOOLS[i].id); return;
    }
  }
  if (e.code === "Escape") {
    if (ed.draw) cancelDraw();
    else if (ed.selected) select(null);
    return;
  }
  if (e.code === "Enter" || e.code === "NumpadEnter") { finishDraw(); return; }
  if (e.code === "Delete" || e.code === "Backspace") {
    // H4.2: aktiver Zugpunkt-Griff — nur diesen Zugpunkt loeschen. Steht vor
    // allen anderen Faellen, weil der Griffindex hinter den Punktgriffen liegt.
    if (ed.selected && aktiverGriff >= 0) {
      var zDel = zugGriffIndex(aktiverGriff);
      var zLDel = zDel >= 0 ? zugpunktListe(ed.selected) : null;
      if (zLDel && zLDel[zDel]) {
        pushUndo();
        zLDel.splice(zDel, 1);
        setAktiverGriff(-1);
        rebuildHandles();
        commit(ed.selected, isHeavy(ed.selected));
        toast("Zugpunkt gelöscht");
        return;
      }
    }
    // H4.4: aktiver Fussgriff einer mehrfuessigen Ranke — nur den Fuss
    // loeschen (Gegenstueck zum Anwachsen per Alt+Klick). Beim letzten Fuss
    // faellt der Fall durch und loescht wie bisher das ganze Element.
    if (ed.selected && ed.selected.kind === "ranke" && aktiverGriff >= 0 &&
        aktiverGriff < ed.selected.points.length && ed.selected.points.length > 1) {
      pushUndo();
      ed.selected.points.splice(aktiverGriff, 1);
      setAktiverGriff(-1);
      rebuildHandles();
      commit(ed.selected, isHeavy(ed.selected));
      toast("Fußpunkt gelöscht");
      return;
    }
    // Aktiver Griff an pfad/flaeche: nur den Punkt loeschen, nicht das Element.
    if (ed.selected && aktiverGriff >= 0 && aktiverGriff < ed.selected.points.length &&
        (ed.selected.kind === "pfad" || ed.selected.kind === "flaeche")) {
      var minPts = ed.selected.kind === "flaeche" ? 3 : 2;
      if (ed.selected.points.length <= minPts) {
        toast(ed.selected.kind === "flaeche"
          ? "Fläche braucht mindestens 3 Punkte"
          : "Pfad braucht mindestens 2 Punkte");
        return;
      }
      pushUndo();
      ed.selected.points.splice(aktiverGriff, 1);
      setAktiverGriff(-1);
      rebuildHandles();
      commit(ed.selected, isHeavy(ed.selected));
      toast("Punkt gelöscht");
      return;
    }
    if (ed.selected) {
      pushUndo();
      var was = ed.selected, heavy = isHeavy(was);
      deleteElement(was);
      ed.selected = null;
      rebuildHandles();
      commit(null, heavy);
      buildPanel();
      toast("Element gelöscht");
    }
  }
}

export { verarbeiteZeiger, onKey, ptr };
