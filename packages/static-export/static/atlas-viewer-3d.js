/** Lazy 3D enhancement for the offline Atlas viewer. The 2D viewer remains the default/fallback. */
(() => {
  const MODULE_SRC = "./atlas-3d.js";
  let modulePromise = null;

  function loadAtlas3D() {
    if (!modulePromise) modulePromise = import(MODULE_SRC).catch(() => null);
    return modulePromise;
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function install() {
    const viewer = window.__uweAtlasStaticViewer;
    if (!viewer || !viewer.canvas) return;
    const atlas3dModule = await loadAtlas3D();
    if (!atlas3dModule || !atlas3dModule.createAtlas3D) return;

    const toolbar = viewer.rootEl.querySelector(".atlas-static-toolbar");
    const wrap = viewer.rootEl.querySelector(".atlas-static-canvas-wrap");
    if (!toolbar || !wrap) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "3D Gelände";
    button.title = "Zwischen 2D-Karte und echtem 3D wechseln";
    button.setAttribute("aria-pressed", "false");
    toolbar.append(button);

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-label", "Atlas-3D-Karte");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "none", cursor: "grab", touchAction: "none" });
    wrap.append(canvas);
    let active = false;
    let atlas = null;

    function grid() {
      const layer = viewer.data.tileLayer;
      return layer ? { cols: layer.cols || 64, rows: layer.rows || 40, elevation: layer.elevation || null } : { cols: 64, rows: 40 };
    }

    async function bakeGround(size) {
      const oldViewport = viewer.viewport;
      const oldObjects = viewer.getNodeObjects;
      const oldEngine = viewer.atlasEngine;
      viewer.viewport = { panX: 0, panY: 0, zoom: 1 };
      viewer.getNodeObjects = () => [];
      viewer.atlasEngine = oldEngine ? { ...oldEngine, hasElevation: () => false } : oldEngine;
      viewer.render();
      await nextPaint();
      const target = document.createElement("canvas");
      target.width = size;
      target.height = Math.round(size / 1.6);
      target.getContext("2d").drawImage(viewer.canvas, 0, 0, target.width, target.height);
      viewer.viewport = oldViewport;
      viewer.getNodeObjects = oldObjects;
      viewer.atlasEngine = oldEngine;
      viewer.render();
      return target;
    }

    function drawObjectSprite(context, object, x, y, size) {
      const engine = viewer.atlasEngine;
      const style = object.style || {};
      const palette = viewer.paletteItems[object.paletteItemId];
      const gouache = style.gouache || (engine && engine.gouacheKeyForGlyph && palette && engine.gouacheKeyForGlyph(palette.builtinGlyphKey));
      if (gouache && engine && engine.drawGouacheAsset && engine.isGouacheAsset(gouache)) {
        engine.drawGouacheAsset(context, gouache, {
          x, y, size, scale: object.scale || 1,
          rotation: ((object.rotation || 0) * Math.PI) / 180,
          lineWidth: style.lineWidth || 1.4,
          blur: style.blur || 0,
          seed: engine.hashStringToSeed ? engine.hashStringToSeed(String(object.id || object.paletteItemId)) : 1,
          tint: style.tint,
        });
        return;
      }
      context.fillStyle = (viewer.preset.colors && viewer.preset.colors.ink) || "#1a1008";
      context.beginPath(); context.arc(x, y - size * 0.2, size * 0.16, 0, Math.PI * 2); context.fill();
    }

    function sync() {
      if (!atlas) return;
      atlas.updateHeights(); atlas.syncObjects(); atlas.invalidateGround(true);
    }

    button.addEventListener("click", () => {
      active = !active;
      button.setAttribute("aria-pressed", String(active));
      button.textContent = active ? "2D Karte" : "3D Gelände";
      viewer.canvas.style.visibility = active ? "hidden" : "visible";
      canvas.style.display = active ? "block" : "none";
      if (!active) return;
      if (!atlas) {
        atlas = atlas3dModule.createAtlas3D(canvas, {
          getGrid: grid,
          getObjects: () => viewer.getNodeObjects(),
          getLightDirection: () => viewer.data.tileLayer && viewer.data.tileLayer.lightDir,
          bakeGround,
          drawObjectSprite,
        }, { leftPan: true, groundBakeSize: 2048 });
        canvas.addEventListener("click", (event) => {
          if (!atlas) return;
          const rect = canvas.getBoundingClientRect();
          const point = atlas.screenToWorldN(event.clientX - rect.left, event.clientY - rect.top);
          if (point) viewer.handleClick(viewer.hitTest(point[0], point[1]));
        });
      }
      sync();
    });
    window.addEventListener("hashchange", () => { if (active) requestAnimationFrame(sync); });
  }

  window.addEventListener("uwe-atlas-static-ready", () => void install(), { once: true });
  if (window.__uweAtlasStaticViewer) void install();
})();
