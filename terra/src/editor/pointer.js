// Zeigereingabe: Zeichnen, Griffe, Pinsel, Orbit/Pan/Zoom — und die Tastatur.
// Mausbewegungen schreiben nur Koordinaten; die Terrain-Strahl-Auswertung laeuft
// gedrosselt auf 30 Hz in der Renderschleife (verarbeiteZeiger).
import { clamp, DEG } from '../core/rng.js';
import { S, HALF, KARTE, mkElement, nextSeed, mkMarker } from '../core/store.js';
import { applyBrush, baseHeightAt, setFlattenTarget, heightAt } from '../world/terrain.js';
import { cam, groundPoint, rayFrom, rayPlane, autoPitch,
  setAufnahme, istAufnahme, aufnahmeAufMotiv } from './camera.js';
import { ed, setTool, finishDraw, cancelDraw, curParams, copyParams, snapPt, TOOLS,
  pinselRadius, auswahlElemente, stempelErzeugen, stempelSetzen, aktuellerStempel,
  genZeichenMarker }
  from './tools.js';
import { handles, rebuildHandles, updateHandlePositions, setPreview, clearPreview, updateBrushRing,
  brushRing, pickElement, select, auswahlUmschalten, naechstesSegment, aktiverGriff,
  setAktiverGriff, zugGriffIndex, zugGriffElement, zugpunktListe, rankeAchsenTreffer,
  zugPixelProHoehe, markerTreffer, waehleMarker, getMarkerAuswahl, rebuildMarker,
  beschriftungenAktualisieren }
  from './selection.js';
// I4: Klick und Zeigerwechsel auf einer Beschriftung.
import { holeBeschriftungsschicht } from '../ui/beschriftung.js';
import { raycaster, _ndc, camera } from './camera.js';
import { regenElement, regenAlleElemente, commit, isHeavy, deleteElement } from '../core/dirty.js';
import { rankePlatzierbar, rankeAchse, rankeKernPunkt } from '../generators/vines.js';
// Bedienungsrunde: Objekte auf Blattplateaus. plateauHoeheAt liest die von
// genRanke veroeffentlichten Plateau-Rahmen (el.plateaus) — zyklusfrei,
// objects.js importiert nichts aus editor/.
import { plateauHoeheAt } from '../generators/objects.js';
import { sucheWeg } from '../generators/wegsuche.js';
import { pushUndo, undo, redo } from './history.js';
import { toast, buildPanel, updateHint, buildRail } from '../ui/panels.js';

var ptr = { down: false, mode: null, x: 0, y: 0, sx: 0, sy: 0, moved: 0, handle: -1,
            grab: null, lastClick: 0, lastCx: -999, lastCy: -999, lastX: 0, lastZ: 0,
            dragged: false, zug: null };
var zeigerOffen = false, zeigerX = 0, zeigerY = 0, zeigerZuletzt = 0;
// Umschalttaste zum letzten Mausereignis — aus dem Event selbst statt aus dem
// globalen keys-Objekt, damit der Modus auch dann stimmt, wenn der Fokus
// zwischendurch im Panel lag.
var zeigerShift = false;
var _zeigerEv = { clientX: 0, clientY: 0 };
// Arbeitspunkte fuer die Zugpunkt-Bearbeitung (Achspunkt mit / ohne Zuganteil)
var _zpA = { x: 0, y: 0, z: 0 }, _zpB = { x: 0, y: 0, z: 0 };

/* ==========================================================================
   A2 — Wegsuche: der halbfertige Zustand zwischen den beiden Klicks

   Bewusst NICHT ed.draw: eine Zeichnung sammelt beliebig viele Punkte, kann
   mit Enter beendet und mit Griffen bearbeitet werden — alles, was hier nicht
   gilt. ed.draw mitzubenutzen hiesse, finishDraw/cancelDraw/rebuildHandles
   und die Hinweiszeile mit Sonderfaellen zu durchsetzen. Ein lokaler Punkt
   ist der ganze Zustand, den das Werkzeug braucht.
   ========================================================================== */
var wegStart = null;

/* ==========================================================================
   Bedienungsrunde — Objekte auf Blattplateaus

   Der Mausstrahl wird gegen die elementeigenen Ranken-Meshes geworfen (die
   Blaetter liegen dort als Geometrie); ein Treffer zaehlt nur, wenn
   plateauHoeheAt an der Stelle wirklich eine Blattoberflaeche kennt — sonst
   traefe auch der Stamm oder ein herabhaengender Bewuchsstrang. Rueckgabe ist
   der Bodenpunkt AUF dem Blatt (x/z), oder null.
   ========================================================================== */
function plateauPunkt(ev) {
  var meshes = [], i, c;
  for (i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== "ranke" || !el.group) continue;
    if (!Array.isArray(el.plateaus) || !el.plateaus.length) continue;
    for (c = 0; c < el.group.children.length; c++) meshes.push(el.group.children[c]);
  }
  if (!meshes.length) return null;
  rayFrom(ev);
  var hits = raycaster.intersectObjects(meshes, true);
  for (i = 0; i < hits.length; i++) {
    var pkt = hits[i].point;
    var ph = plateauHoeheAt(pkt.x, pkt.z);
    if (ph !== null && Math.abs(ph - pkt.y) < 3.5) return { x: pkt.x, z: pkt.z };
  }
  return null;
}

/** Bricht eine begonnene Suche ab. Liefert true, wenn wirklich eine lief. */
function wegAbbrechen() {
  if (!wegStart) return false;
  wegStart = null;
  clearPreview();
  updateHint();
  return true;
}

/* Schrittweite der Suche: die Knotenzahl waechst quadratisch mit 1/schritt.
   Auf einer 1024er Karte sind das bei 2 rund 263 000 Knoten (gemessen 22 ms),
   bei 4 nur ein Viertel davon (~5 ms) — und der Unterschied ist im Ergebnis
   nicht zu sehen, weil Douglas-Peucker den Weg ohnehin auf wenige
   Stuetzpunkte eindampft. Kleinere Karten bleiben beim feineren Gitter, dort
   kostet es nichts. */
function wegOptionen() {
  return { schritt: KARTE.map >= 1024 ? 4 : 2 };
}

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
    /* Bedienungsrunde: Klick auf ein Blattplateau setzt das Objekt DORT oben
       auf. Der Zweig steht VOR der Bodenpunkt-Pruefung, weil der Strahl hoch
       am Blatt oft keinen (oder einen weit dahinterliegenden) Boden trifft.
       Das Element merkt sich die Lage in params.aufPlateau — genObjekt
       platziert dann ueber die Blattoberflaeche statt ueber heightAt, auch
       bei jedem spaeteren Neuaufbau. Kein snapPt: das Raster gehoert zum
       Boden, auf einem Blatt schoebe es den Punkt womoeglich ueber den Rand. */
    if (ed.tool === "objekt" && ed.variantOf.objekt !== "inseln") {
      var pp = plateauPunkt(e);
      if (pp) {
        ptr.mode = "scatter";
        pushUndo();
        var pel = mkElement("objekt", ed.variantOf.objekt, [{ x: pp.x, z: pp.z }],
          copyParams(curParams()), nextSeed());
        pel.params.aufPlateau = true;
        S.elements.push(pel);
        regenElement(pel);
        ptr.scatterEl = pel;
        ptr.lastX = pp.x; ptr.lastZ = pp.z;
        select(pel);
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
    /* I2 — Biompinsel. Er ist eine PFADVARIANTE, wird aber wie der
       Terrainpinsel bedient: druecken, ziehen, loslassen. Der Zweig steht
       deshalb hier oben bei den Zieh-Werkzeugen und nicht unten bei der
       Klick-für-Klick-Zeichnung des Pfadwerkzeugs — die Punkte kommen aus dem
       Zug, nicht aus einzelnen Klicks.

       Kein snapPt: ein Pinselstrich hat keine Stuetzpunkte, die auf ein Raster
       gehoerten; das Raster taktete nur die Tupfer und liesse eine gerade
       gezogene Linie stufig werden. */
    if (ed.tool === "pfad" && ed.variantOf.pfad === "biompinsel") {
      // Umschalten mitten in einer Pfadzeichnung: die halbe Linie darf nicht
      // als Vorschau stehenbleiben, waehrend der Pinsel malt.
      if (ed.draw) cancelDraw();
      ptr.mode = "biompinsel";
      pushUndo();
      var bp = mkElement("pfad", "biompinsel", [{ x: p.x, z: p.z }],
        copyParams(curParams()), nextSeed());
      S.elements.push(bp);
      ptr.pinselEl = bp;
      ptr.lastX = p.x; ptr.lastZ = p.z;
      setPreview(bp.points, null, false);
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
      /* F4: Im Aufnahme-Modus haelt updateCamera die Neigung ohnehin auf dem
         komponierten Wert (cam.tPitch = AUF.pitch, jedes Bild). Ohne diesen
         Riegel schriebe das Ziehen tPitch dazwischen immer wieder voll und der
         Wert zappelte sinnlos zwischen zwei Quellen hin und her — sichtbar
         wuerde davon nichts, gerechnet schon. Gieren bleibt frei, nur die
         Bildaufteilung ist eingerastet. */
      if (!istAufnahme()) cam.tPitch = clamp(cam.tPitch + dy * 0.004, 22 * DEG, 68 * DEG);
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
    /* I2 — Der Strich ist fertig: EIN schwerer Commit. Waehrend des Zugs
       laeuft bewusst keiner. Ein Commit stempelt die Biommaske komplett neu,
       rechnet Hoehen, AO und Gitterfarben im Einflussbereich nach und erzeugt
       alle Elemente neu — das je Zeigerschritt zu tun hiesse, dieselbe Arbeit
       dreissigmal je Sekunde zu leisten. Waehrend des Zugs zeigen Ring und
       Vorschaulinie, was gemalt wird; die Farbe kommt beim Loslassen. Genau
       die Aufteilung, die auch die Wegsuche und die Regler im Panel benutzen. */
    if (wasMode === "biompinsel") {
      var bel = ptr.pinselEl;
      ptr.pinselEl = null;
      clearPreview();
      if (bel) {
        commit(bel, true);
        select(bel);
        toast("Biom „" + (bel.params.biom || "?") + "“ aufgetragen ("
          + bel.points.length + (bel.points.length === 1 ? " Punkt" : " Punkte")
          + ") — Radius und Biom im Panel rechts");
      }
      return;
    }
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

    /* D1 — Markerwerkzeug. Der Zweig steht VOR der Bodenpunkt-Pruefung, weil
       eine Nadel bergaufwaerts auch dann getroffen wird, wenn der Strahl
       dahinter keinen Boden mehr findet: das Auswaehlen und Umbenennen eines
       bestehenden Markers braucht keinen Bodenpunkt, nur das Setzen. */
    if (ed.tool === "marker") {
      /* I4 — die Variante „beschriftung" legt ein ELEMENT an, keine Nadel.
         Der Zweig steht ganz vorn, weil markerTreffer() nur die flache
         S.marker-Liste kennt und eine Beschriftung dort nie auftauchen wird. */
      if (ed.variantOf.marker === "beschriftung") {
        var bp0 = groundPoint(e);
        if (!bp0) return;
        pushUndo();
        var bel = mkElement("marker", "beschriftung", [snapPt(bp0)],
          copyParams(curParams()), nextSeed());
        S.elements.push(bel);
        select(bel);
        beschriftungenAktualisieren();
        toast("Beschriftung gesetzt — Text und Ziel im Panel rechts");
        return;
      }
      /* Runde H (Bedienung) — die Variante „zeichen" setzt ein handgesetztes
         Kartenzeichen (Katalog Q = H). Wie „beschriftung" ein ELEMENT, keine
         Nadel; die Instanz erzeugt genZeichenMarker sofort — kein commit():
         genElement in core/dirty.js kennt den Zweig noch nicht und wuerde die
         frische Instanz gleich wieder leeren (siehe tools.js, dort steht auch
         die fehlende Zeile fuer dirty.js). */
      if (ed.variantOf.marker === "zeichen") {
        var zg0 = groundPoint(e);
        if (!zg0) return;
        pushUndo();
        var zel = mkElement("marker", "zeichen", [snapPt(zg0)],
          copyParams(curParams()), nextSeed());
        S.elements.push(zel);
        var zn = genZeichenMarker(zel);
        select(zel);
        toast(zn
          ? "Kartenzeichen gesetzt — Art, Größe und Drehung im Panel rechts"
          : "Kartenzeichen gesetzt — auf diesem Maßstab unsichtbar (erscheint auf Kartenmaßstab)");
        return;
      }
      var mi = markerTreffer(e);
      if (mi >= 0) {
        waehleMarker(mi);
        if (isDouble) {
          // Text aendern. prompt() ist schlicht, aber ausreichend: eine
          // Eingabezeile gehoerte ins Panel (ui/panels.js) — Vorschlag im
          // Bericht. Abbruch (null) laesst den Text unveraendert.
          var neuT = prompt("Beschriftung des Markers", S.marker[mi].text);
          if (neuT !== null) { S.marker[mi].text = String(neuT); rebuildMarker(); }
        }
        toast(S.marker[mi].text
          ? "Marker: " + S.marker[mi].text + " (Entf löscht, Doppelklick ändert den Text)"
          : "Marker ohne Text (Doppelklick beschriftet, Entf löscht)");
        return;
      }
      var mp0 = groundPoint(e);
      if (!mp0) return;
      var mp = snapPt(mp0);
      var txt = prompt("Beschriftung des neuen Markers", "");
      if (txt === null) return;                 // Abbruch setzt nichts
      S.marker.push(mkMarker(mp.x, mp.z, String(txt), ed.variantOf.marker));
      waehleMarker(S.marker.length - 1);
      toast("Marker gesetzt (" + S.marker.length + " auf der Karte)");
      return;
    }

    /* I4 — Klick auf eine Beschriftung. Steht VOR groundPoint, weil eine
       Beschriftung ueber dem Horizont oder ueber Wasser haengen kann, wo der
       Strahl keinen Boden mehr trifft; ohne diese Reihenfolge waere sie dort
       nicht anklickbar.

       Treffer per Raycast auf das Sprite statt ueber ein HTML-Overlay: kein
       DOM-Abgleich, funktioniert im Vollbild und waehrend einer Kamerafahrt.
       Im Aufnahme-Modus liefert klick() immer false — das Bild soll ein Bild
       sein und keine Bedienoberflaeche. */
    // rayFrom setzt den geteilten `raycaster` und liefert dessen Strahl —
    // gebraucht wird hier der Raycaster selbst (intersectObjects).
    rayFrom(e);
    if (holeBeschriftungsschicht().klick(raycaster, { aufnahme: istAufnahme() })) return;

    var p = groundPoint(e);
    /* Schwebende Objekte koennen oberhalb des Horizonts liegen. Dort hat der
       Strahl keinen Bodenpunkt, die echte 3D-Auswahl darf aber trotzdem
       treffen (Luftinseln, Flugschiffe und Flugzuege). */
    if (!p && ed.tool === "auswahl") {
      var luftTreffer = pickElement(e, null);
      if (e.shiftKey && luftTreffer) auswahlUmschalten(luftTreffer);
      else select(luftTreffer);
      return;
    }
    if (!p) return;

    /* ======================================================================
       A2 — Wegsuche: erster Klick setzt den Start, zweiter sucht und baut.

       Kein Doppelklick-Sonderfall noetig: die beiden Klicks liegen an
       verschiedenen Stellen, ein Doppelklick auf denselben Fleck ergaebe
       Start == Ziel und faellt unten sauber durch (sucheWeg liefert dann eine
       Zweipunktliste ohne Laenge, die als "zu kurz" verworfen wird).
       ====================================================================== */
    if (ed.tool === "wegsuche") {
      var wsp = snapPt(p);
      if (!wegStart) {
        wegStart = wsp;
        // Einzelner Punkt: setPreview zeigt erst ab zwei Punkten etwas an —
        // das Gummiband entsteht in verarbeiteZeiger, sobald die Maus zieht.
        setPreview([wegStart], null, false);
        toast("Wegsuche: Startpunkt gesetzt — jetzt das Ziel klicken (Esc bricht ab)");
        updateHint();
        return;
      }
      var wVon = wegStart, wNach = wsp;
      var weg = sucheWeg(wVon, wNach, wegOptionen());
      /* „Kein Treffer“ ist hier BEIDES: eine zu kurze Liste und ein
         unvollstaendiger Weg. sucheWeg liefert im zweiten Fall den besten
         Teilweg zurueck (damit ein Aufrufer nicht leer ausgeht) — als
         Editor-Ergebnis waere das aber eine Straße, die im Nirgendwo endet,
         und der Nutzer haette sie fuer den gewuenschten Weg gehalten. Lieber
         nichts anlegen und es sagen. */
      if (!weg || weg.length < 2 || !weg.vollstaendig || weg.laenge < 1) {
        wegAbbrechen();
        toast(weg && weg.length >= 2 && !weg.vollstaendig
          ? "Kein durchgehender Weg zum Ziel gefunden — anderen Zielpunkt wählen"
          : "Start und Ziel liegen zu dicht beieinander");
        return;
      }
      /* Eigene Punktobjekte: die Liste aus sucheWeg traegt Zusatzfelder und
         gehoert nicht dem Element. Ausserdem soll das Raster (S.snap) auch
         hier greifen — und genau dadurch koennen zwei Stuetzpunkte auf
         dieselbe Rasterzelle fallen; ein doppelter Nachbarpunkt ergaebe in
         pathSamples ein Kurvenstueck der Laenge null. */
      var wPts = [];
      for (var wi = 0; wi < weg.length; wi++) {
        var wq = snapPt(weg[wi]), wl = wPts[wPts.length - 1];
        if (wl && wl.x === wq.x && wl.z === wq.z) continue;
        wPts.push(wq);
      }
      // Erst pruefen, dann den Undo-Punkt setzen: bis hierher ist die Karte
      // unveraendert, ein Abbruch darf keinen leeren Schritt hinterlassen.
      if (wPts.length < 2) { wegAbbrechen(); toast("Der gefundene Weg ist zu kurz"); return; }
      pushUndo();
      var wVar = ed.variantOf.wegsuche;
      // kind ist "pfad": das Ergebnis ist ein ganz gewoehnliches Pfad-Element,
      // das sich danach mit Griffen, Panel und Varianten weiterbearbeiten
      // laesst. "wegsuche" ist nur die Art, wie seine Punkte entstanden sind.
      var wEl = mkElement("pfad", wVar, wPts, copyParams(curParams()), nextSeed());
      S.elements.push(wEl);
      wegStart = null;
      clearPreview();
      commit(wEl, isHeavy(wEl));
      select(wEl);
      toast("Weg gefunden: " + Math.round(weg.laenge) + " Einheiten, "
        + wPts.length + " Stützpunkte" + (weg.ms >= 1 ? " (" + Math.round(weg.ms) + " ms)" : ""));
      updateHint();
      return;
    }

    /* A3 — Stempelwerkzeug: Klick setzt die Komposition an der Mausposition.
       Ausrichtung kommt aus dem Zustand (R dreht, M spiegelt), nicht aus
       Modifiertasten beim Klick: so sieht man vor dem Setzen im Toast, was
       gesetzt wird, und kann mehrere Stempel gleich ausgerichtet platzieren. */
    if (ed.tool === "stempel") {
      var st = aktuellerStempel();
      if (!st) {
        toast("Keine Stempel in der Bibliothek — Elemente mit Shift+Klick wählen und K drücken");
        return;
      }
      pushUndo();
      var n = stempelSetzen(st, snapPt(p));
      toast(n ? "Stempel „" + st.name + "“ gesetzt (" + n + " Elemente, neue Seeds)"
              : "Stempel ist leer");
      updateHint();
      return;
    }

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
      /* A3 — Shift+Klick erweitert die Auswahl bzw. nimmt ein Element wieder
         heraus. Ohne Shift bleibt alles exakt wie bisher: select() setzt die
         Liste auf genau dieses eine Element. */
      var getroffen = pickElement(e, p);
      if (e.shiftKey && getroffen) {
        var anz = auswahlUmschalten(getroffen);
        toast(anz === 1 ? "1 Element ausgewählt"
                        : anz + " Elemente ausgewählt (K macht daraus einen Stempel)");
        return;
      }
      select(getroffen);
      return;
    }
    // I1: der Ausschnitt zeichnet wie eine Flaeche — Klick setzt Punkte,
    // Doppelklick schliesst. Was danach entsteht, ist keine Flaeche, sondern
    // eine Karte; das entscheidet finishDraw, nicht dieser Zweig.
    if (ed.tool === "pfad" || ed.tool === "flaeche" || ed.tool === "ausschnitt") {
      if (isDouble) { finishDraw(); return; }
      if (!ed.draw) ed.draw = { kind: ed.tool, variant: ed.variantOf[ed.tool] || "", points: [] };
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
  /* A2: eine begonnene Suche ueberlebt den Werkzeugwechsel nicht — sonst
     bliebe das Gummiband stehen und der naechste Klick mit Werkzeug 9 fiele
     in einen Zustand, den man laengst vergessen hat. Der Test steht VOR der
     Drosselung, weil setTool (tools.js) den Zustand nicht selbst raeumen
     kann: er liegt hier, und tools.js darf pointer.js nicht importieren
     (pointer.js importiert tools.js — das ergaebe einen Zyklus). */
  if (wegStart && ed.tool !== "wegsuche") wegAbbrechen();
  if (!zeigerOffen || now - zeigerZuletzt < 33) return;
  zeigerZuletzt = now; zeigerOffen = false;
  _zeigerEv.clientX = zeigerX; _zeigerEv.clientY = zeigerY;
  var p = groundPoint(_zeigerEv);

  if (ptr.mode === "brush" && p) {
    applyBrush(p, ed.variantOf.terrain, curParams().radius, curParams().staerke, 1 / 60);
    updateBrushRing(p, curParams().radius);
    return;
  }
  /* I2 — Biompinsel im Zug. Aufgebaut wie der Streuzweig darunter: ein neuer
     Stuetzpunkt erst ab einem Mindestabstand, sonst sammelte ein Zittern
     hundert Punkte auf derselben Stelle. Der halbe Radius ist genau der
     Tupferabstand, den die Ableitung benutzt (pinselTupfer in core/dirty.js) —
     feiner aufzuzeichnen braechte nichts, weil sie ohnehin auf der Kurve
     zwischen den Stuetzpunkten nachsampelt. Das haelt auch das Element klein:
     ein langer Strich sind ein paar Dutzend Punkte, nicht ein paar hundert. */
  if (ptr.mode === "biompinsel" && p && ptr.pinselEl) {
    var pr = ptr.pinselEl.params.radius || 12;
    updateBrushRing(p, pr);
    if (Math.hypot(p.x - ptr.lastX, p.z - ptr.lastZ) > Math.max(1.5, pr * 0.5)) {
      ptr.pinselEl.points.push({ x: p.x, z: p.z });
      ptr.lastX = p.x; ptr.lastZ = p.z;
      setPreview(ptr.pinselEl.points, null, false);
    }
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
  if (ptr.mode === "scatter" && ptr.scatterEl) {
    // Bedienungsrunde: eine Plateau-Streuung zieht ihre Punkte vom Blatt,
    // nicht vom Boden darunter — dort landete der Zug sonst im Nichts.
    var aufBlatt = !!ptr.scatterEl.params.aufPlateau;
    var sq = aufBlatt ? plateauPunkt(_zeigerEv) : p;
    if (sq) {
      var d = Math.hypot(sq.x - ptr.lastX, sq.z - ptr.lastZ);
      if (d > Math.max(2.5, ptr.scatterEl.params.streuung * 0.8)) {
        var sp2 = aufBlatt ? { x: sq.x, z: sq.z } : snapPt(sq);
        ptr.scatterEl.points.push(sp2);
        ptr.lastX = sp2.x; ptr.lastZ = sp2.z;
        regenElement(ptr.scatterEl);
      }
    }
    return;
  }
  // I2: den Ring zeigt jedes Werkzeug, das im Kreis malt — Terrain und
  // Biompinsel. Die Frage beantwortet pinselRadius (editor/tools.js).
  var pinR = pinselRadius();
  if (pinR) updateBrushRing(p, pinR);
  else brushRing.visible = false;
  if (ed.draw && p) setPreview(ed.draw.points, snapPt(p), ed.draw.kind === "flaeche");
  /* A2 — Gummiband der Wegsuche: die GERADE Verbindung Start–Maus, nicht der
     gesuchte Weg. Eine Live-Suche je 33 ms waere auf einer grossen Karte
     teuer und zeigte dauernd einen anderen Verlauf; die Gerade sagt genau
     das, was sie soll — "von hier nach dort", der Rest ist Sache der Suche. */
  else if (wegStart && p) setPreview([wegStart], snapPt(p), false);
}

function onKey(e) {
  if (e.ctrlKey || e.metaKey) {
    /* Undo/Redo ueber e.key statt e.code: e.code nennt die PHYSISCHE Taste,
       und auf QWERTZ sitzt das aufgedruckte Z auf der physischen KeyY —
       Strg+Z loeste dort ein Redo aus. e.key folgt der Tastaturbelegung und
       trifft damit QWERTZ und QWERTY gleichermassen; Strg+Shift+Z bleibt als
       zweiter Redo-Weg erhalten. */
    var taste = typeof e.key === "string" ? e.key.toLowerCase() : "";
    if (taste === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (taste === "y" || (taste === "z" && e.shiftKey)) { e.preventDefault(); redo(); return; }
    return;
  }
  for (var i = 0; i < TOOLS.length; i++) {
    if (e.code === "Digit" + TOOLS[i].key || e.code === "Numpad" + TOOLS[i].key) {
      setTool(TOOLS[i].id); return;
    }
  }
  if (e.code === "Escape") {
    // A2 zuerst: eine begonnene Wegsuche ist der juengste offene Vorgang und
    // schliesst sich immer nur mit einem zweiten Klick oder mit Esc.
    if (wegAbbrechen()) { toast("Wegsuche abgebrochen"); return; }
    if (ed.draw) cancelDraw();
    else if (getMarkerAuswahl() >= 0) waehleMarker(-1);
    else if (ed.selected) select(null);
    return;
  }
  if (e.code === "Enter" || e.code === "NumpadEnter") { finishDraw(); return; }
  /* A3 — Tastenkuerzel der Stempel. Bewusst Buchstaben statt Panel-Knoepfe:
     ui/panels.js gehoert dieser Runde nicht (Vorschlag fuer Knoepfe steht im
     Bericht), und K/R/M sind frei — belegt sind WASD/QE (Kamera), die Ziffern
     (Werkzeuge) und Strg+Z/Y. */
  if (e.code === "KeyK") {
    var sel = auswahlElemente();
    if (!sel.length) { toast("Erst Elemente wählen (Auswahl-Werkzeug, Shift+Klick fügt hinzu)"); return; }
    var name = prompt("Name des Stempels (" + sel.length + " Elemente)", "");
    if (name === null) return;
    var st = stempelErzeugen(String(name));
    if (!st) { toast("Stempel braucht einen Namen"); return; }
    toast("Stempel „" + st.name + "“ gespeichert — Werkzeug 8 setzt ihn");
    buildPanel();
    return;
  }
  if (e.code === "KeyR" && ed.tool === "stempel") {
    ed.stempelDrehung = (ed.stempelDrehung + 1) & 3;
    toast("Stempeldrehung " + (ed.stempelDrehung * 90) + "°");
    return;
  }
  if (e.code === "KeyM" && ed.tool === "stempel") {
    ed.stempelSpiegel = !ed.stempelSpiegel;
    toast(ed.stempelSpiegel ? "Stempel gespiegelt" : "Stempel ungespiegelt");
    return;
  }
  /* F4 — Aufnahme-Modus umschalten.

     Taste geprueft: KeyC ist frei. Belegt sind WASD und QE (Kamera, in
     camera.js ueber das keys-Objekt), die Ziffern 1-9 samt Numpad
     (Werkzeuge, Schleife oben), K/R/M (Stempel), Escape, Enter/NumpadEnter,
     Entf/Backspace und Strg+Z / Strg+Y / Strg+Shift+Z. Ein KeyC kommt in
     terra/src ausser hier nirgends vor.

     Kein Werkzeugwechsel: ed.tool bleibt unberuehrt, die Auswahl auch — man
     schaltet in die Komposition und weiter mit derselben Arbeit heraus. Ist
     nach dem Umschalten ein Element gewaehlt, richtet aufnahmeAufMotiv die
     Einstellung zusaetzlich auf dessen ERSTEN Punkt aus (Fusspunkt der Ranke,
     Startpunkt des Pfades, erster Umrisspunkt der Flaeche) — die Hoehe kommt
     aus dem Gelaende, weil Elementpunkte nur x/z tragen. */
  if (e.code === "KeyC") {
    var aufAn = setAufnahme(!istAufnahme());
    var motiv = null;
    if (aufAn && ed.selected && ed.selected.points && ed.selected.points.length) {
      var mp = ed.selected.points[0];
      motiv = aufnahmeAufMotiv({ x: mp.x, y: heightAt(mp.x, mp.z), z: mp.z });
    }
    toast(!aufAn ? "Aufnahme-Modus aus — freie Ansicht"
      : motiv ? "Aufnahme auf das gewählte Element ausgerichtet"
          + (motiv.beschnitten ? " (Kartenrand — Motiv nicht ganz auf dem Drittel)" : "")
      : "Aufnahme-Modus an — Horizont auf einem Drittel (C schaltet zurück)");
    buildRail();                     // Knopfzustand in der Werkzeugleiste
    return;
  }
  if (e.code === "Delete" || e.code === "Backspace") {
    // D1: ausgewaehlter Marker zuerst — er kann nur im Markerwerkzeug
    // ausgewaehlt sein (setTool raeumt die Auswahl beim Wechsel weg), es gibt
    // also keine Ueberschneidung mit den Elementfaellen darunter.
    var mSel = getMarkerAuswahl();
    if (mSel >= 0 && mSel < S.marker.length) {
      S.marker.splice(mSel, 1);
      waehleMarker(-1);            // baut die Nadeln mit neuer Indizierung neu
      toast("Marker gelöscht");
      return;
    }
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
      /* A3: bei einer Mehrfachauswahl loescht Entf die GANZE Auswahl. Nur
         ed.selected zu loeschen liesse die uebrigen Eintraege als Auswahl
         ohne fuehrendes Element zurueck — und "markieren, dann loeschen" ist
         genau der Grund, aus dem man mehrere Elemente waehlt. */
      var zuLoeschen = auswahlElemente();
      if (zuLoeschen.indexOf(ed.selected) < 0) zuLoeschen.push(ed.selected);
      var heavy = false;
      for (var di = 0; di < zuLoeschen.length; di++) {
        if (isHeavy(zuLoeschen[di])) heavy = true;
        deleteElement(zuLoeschen[di]);
      }
      ed.selected = null;
      ed.auswahl.length = 0;
      rebuildHandles();
      commit(null, heavy);
      buildPanel();
      toast(zuLoeschen.length > 1 ? zuLoeschen.length + " Elemente gelöscht" : "Element gelöscht");
    }
  }
}

export { verarbeiteZeiger, onKey, ptr };
