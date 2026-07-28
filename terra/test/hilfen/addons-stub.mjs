/* Platzhalter fuer `three/addons/*`. Nur render/pipeline.js importiert daraus,
   und die Pipeline selbst wird im Test durch ersatz/pipeline.js ersetzt —
   dieser Stub faengt lediglich den Fall ab, dass ein Modul die Namen doch
   einmal auflost. */
class Leer {
  constructor() {}
  setSize() {} render() {} dispose() {} addPass() {} insertPass() {} removePass() {}
}
export { Leer as EffectComposer, Leer as RenderPass, Leer as UnrealBloomPass,
  Leer as ShaderPass, Leer as OutputPass, Leer as SMAAPass, Leer as Pass };
