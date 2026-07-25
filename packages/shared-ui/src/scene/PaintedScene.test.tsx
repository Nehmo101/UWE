import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PaintedScene } from "./PaintedScene";
import { AppAccentScope } from "./AppAccentScope";
import { resolveScenePair, sceneUrl } from "./pickScene";
import { SCENE_BREAKPOINT_PX } from "./scenePools";

const designV2Dir = path.join(__dirname, "..", "design-v2");

describe("PaintedScene", () => {
  it("renders both viewport fassungen so CSS can art-direct without JS", () => {
    const html = renderToStaticMarkup(<PaintedScene area="landing" sceneIndex={0} />);
    const desktop = resolveScenePair("landing", "desktop", 0);
    const mobil = resolveScenePair("landing", "mobil", 0);

    for (const scene of [desktop.day, desktop.night, mobil.day, mobil.night]) {
      assert.ok(html.includes(sceneUrl(scene)), `missing ${scene.src}`);
    }
    // Der Server darf den Viewport nicht raten — beide Fassungen stehen drin.
    assert.match(html, /--uwe-scene-day-desktop/);
    assert.match(html, /--uwe-scene-day-mobil/);
  });

  it("carries the curated crop of each motif", () => {
    const html = renderToStaticMarkup(<PaintedScene area="brain" sceneIndex={2} />);
    const desktop = resolveScenePair("brain", "desktop", 2);
    assert.ok(html.includes(desktop.day.pos), "day crop");
    assert.ok(html.includes(desktop.night.pos), "night crop");
  });

  it("preloads exactly the day's two layers per viewport — not the whole pool", () => {
    const html = renderToStaticMarkup(<PaintedScene area="portal" sceneIndex={1} />);
    const preloads = html.match(/rel="preload"/g) ?? [];
    assert.equal(preloads.length, 4, "2 layers x 2 viewports");
    assert.ok(html.includes(`media="(min-width: ${SCENE_BREAKPOINT_PX}px)"`));
    assert.ok(html.includes(`media="(max-width: ${SCENE_BREAKPOINT_PX - 1}px)"`));
  });

  it("can be rendered without preload links", () => {
    const html = renderToStaticMarkup(
      <PaintedScene area="studio" sceneIndex={0} preload={false} />,
    );
    assert.ok(!html.includes('rel="preload"'));
  });

  it("is inert for assistive tech and for the pointer", () => {
    const html = renderToStaticMarkup(<PaintedScene area="landing" sceneIndex={0} />);
    assert.match(html, /aria-hidden="true"/);
  });

  it("supports the Studio band and per-screen ground gradient", () => {
    const html = renderToStaticMarkup(
      <PaintedScene
        area="studio"
        sceneIndex={0}
        height="band"
        bandHeight="62%"
        veil="band"
        groundStart="26%"
        groundEnd="58%"
      />,
    );
    assert.match(html, /data-height="band"/);
    assert.match(html, /data-veil="band"/);
    assert.ok(html.includes("--uwe-scene-band-height:62%"));
    assert.ok(html.includes("--uwe-scene-ground-start:26%"));
    assert.ok(html.includes("--uwe-scene-ground-end:58%"));
  });

  it("prefixes urls with a basePath for the Portal sub-path deployment", () => {
    const html = renderToStaticMarkup(
      <PaintedScene area="portal" sceneIndex={0} basePath="/portal" />,
    );
    assert.ok(html.includes("/portal/scenes/"));
    assert.ok(!html.includes('url("/scenes/'));
  });

  it("keeps the CSS breakpoint and the TS constant in sync", () => {
    // Eine Media-Query kann keine JS-Konstante lesen — hier wird der Gleichlauf
    // erzwungen statt gehofft.
    const css = readFileSync(path.join(designV2Dir, "painted-scene.css"), "utf8");
    assert.ok(
      css.includes(`@media (min-width: ${SCENE_BREAKPOINT_PX}px)`),
      "painted-scene.css must switch at SCENE_BREAKPOINT_PX",
    );
  });
});

describe("AppAccentScope", () => {
  it("marks the subtree so the accent CSS can win over the inherited value", () => {
    const html = renderToStaticMarkup(
      <AppAccentScope app="portal">
        <span>x</span>
      </AppAccentScope>,
    );
    assert.match(html, /class="uwe-accent-scope"/);
    assert.match(html, /data-accent-app="portal"/);
  });

  it("defines every app in both modes", () => {
    const css = readFileSync(path.join(designV2Dir, "app-accent.css"), "utf8");
    for (const app of ["studio", "portal", "brain"]) {
      for (const theme of ["uwe-ghibli-tag", "uwe-ghibli-nacht"]) {
        assert.ok(
          css.includes(`html[data-uwe-theme="${theme}"] .uwe-accent-scope[data-accent-app="${app}"]`),
          `${theme}/${app}`,
        );
      }
    }
  });

  it("pins on-accent, which the engine would otherwise derive to black", () => {
    // #c2622b liegt knapp über der WCAG-Luminanzschwelle — ohne diese Zeile
    // stünde schwarzer statt papierweißer Text auf dem Terrakotta-Button.
    const css = readFileSync(path.join(designV2Dir, "app-accent.css"), "utf8");
    assert.match(css, /--uwe-on-accent: #fbf5e6/);
  });
});
