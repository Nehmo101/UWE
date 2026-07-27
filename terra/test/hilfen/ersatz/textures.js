/* Ersatz fuer render/textures.js.
   Die echte Fabrik malt 20 Texturen Pixel fuer Pixel in ein Canvas — ohne DOM
   nicht lauffaehig und fuer die fuenf Testebenen ohne Aussagewert (keine
   Geometrie, kein Zufall ausserhalb der ohnehin geprueften rng.js). Hier
   liefert TEX fuer jeden Namen ein Texturobjekt mit denselben Feldern, die die
   Aufrufer lesen. */
const bilder = {};
function texturFuer(name) {
  if (!bilder[name]) {
    bilder[name] = {
      name,
      // `image` ist im Original ein Canvas: generators/geometry.js malt die
      // unterste Zeile der Kronentexturen opak nach. Der Kontext ist deshalb
      // vorhanden und tut nichts — die Pixel selbst liest kein Test.
      image: {
        width: 256, height: 256, data: null,
        getContext() {
          return { fillStyle: '', fillRect() {}, drawImage() {}, clearRect() {} };
        }
      },
      wrapS: 1001, wrapT: 1001, needsUpdate: false, colorSpace: '',
      generateMipmaps: true, repeat: { x: 1, y: 1 }, offset: { x: 0, y: 0 },
      dispose() {}
    };
  }
  return bilder[name];
}
export const TEX = new Proxy({}, {
  get(_z, name) { return typeof name === 'string' ? texturFuer(name) : undefined; },
  set() { return true; },
  has() { return true; },
  ownKeys() { return Object.keys(bilder); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
});
export function texCanvas() { return { width: 256, height: 256 }; }
export function texFinish(_canvas, name) { return texturFuer(name); }
export function texPaint() { return { width: 256, height: 256 }; }
