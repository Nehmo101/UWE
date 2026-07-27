/* ==========================================================================
   Minimales DOM fuer Node.

   Gebraucht wird es nur an wenigen Stellen: editor/io.js fuehrt beim
   Uebernehmen einer Karte die Auswahlfelder der Leiste nach
   (document.getElementById("seed") usw.), core/store.js liest und schreibt
   localStorage. Alles andere Browser-Nahe ist ueber die Ersatzmodule
   ausgeschlossen.

   Bewusst KEIN window: render/materials.js prueft `typeof window !== 'undefined'`,
   um `window.terraPatchInfo` zu setzen. Ohne window bleibt dieser Zweig aus —
   und die Tests laufen damit auf demselben Pfad, den auch ein Kopfloser-Lauf
   nimmt. Wer window braucht, setzt es im Test selbst.
   ========================================================================== */
class TestElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.checked = false;
    this._klassen = new Set();
    const self = this;
    this.classList = {
      add(c) { self._klassen.add(c); },
      remove(c) { self._klassen.delete(c); },
      contains(c) { return self._klassen.has(c); },
      toggle(c, an) {
        const soll = an === undefined ? !self._klassen.has(c) : !!an;
        if (soll) self._klassen.add(c); else self._klassen.delete(c);
        return soll;
      }
    };
  }
  appendChild(k) { this.children.push(k); return k; }
  removeChild(k) { const i = this.children.indexOf(k); if (i >= 0) this.children.splice(i, 1); return k; }
  addEventListener() {}
  removeEventListener() {}
  querySelectorAll() { return []; }
  getContext() {
    return {
      createImageData: (w, h) => ({ width: w, height: h || w, data: new Uint8ClampedArray(w * (h || w) * 4) }),
      getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {}, drawImage() {}, fillRect() {}, clearRect() {},
      save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
      moveTo() {}, lineTo() {}, arc() {}, translate() {}, rotate() {}, scale() {},
      fillText() {}, measureText: () => ({ width: 0 })
    };
  }
  toDataURL() { return 'data:,'; }
}

const nachId = new Map();
/** Legt ein Element unter dieser id ab (Testhilfe). */
export function setzeElement(id, el) {
  const e = el || new TestElement('div');
  nachId.set(id, e);
  return e;
}

if (typeof globalThis.document === 'undefined') {
  // Die Felder, die editor/io.js beim Uebernehmen einer Karte nachfuehrt.
  for (const id of ['seed', 'biomSel', 'kartenSel', 'wetterSel', 'snapBtn', 'fxBtn',
    'seedApply', 'saveBtn', 'loadBtn', 'pngBtn', 'fileIn', 'hoehenbildBtn',
    'hoehenbildIn', 'panel', 'rail', 'bar', 'stats', 'hint', 'toast']) {
    setzeElement(id, new TestElement(id.endsWith('Sel') ? 'select' : 'div'));
  }
  globalThis.document = {
    createElement(t) { return new TestElement(t); },
    createElementNS() { return new TestElement('canvas'); },
    getElementById(id) { return nachId.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    body: new TestElement('body'),
    documentElement: new TestElement('html')
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const speicher = new Map();
  globalThis.localStorage = {
    getItem(k) { return speicher.has(k) ? speicher.get(k) : null; },
    setItem(k, v) { speicher.set(k, String(v)); },
    removeItem(k) { speicher.delete(k); },
    clear() { speicher.clear(); },
    key(i) { return Array.from(speicher.keys())[i] ?? null; },
    get length() { return speicher.size; }
  };
}

export { TestElement };
