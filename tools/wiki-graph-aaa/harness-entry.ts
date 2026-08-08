/**
 * Browser entry for the Wiki-Graph AAA visual harness.
 * Bundled via esbuild into harness-bundle.mjs — uses the real GraphEngine.
 */

import { GraphEngine } from "../../packages/shared-ui/src/graph-engine";
import { buildFixture, type FixtureGraph } from "./fixture-graph";

export type { FixtureGraph };
export { buildFixture };

export interface HarnessApi {
  engine: GraphEngine;
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  fixture: FixtureGraph;
  ready: boolean;
  settle: (ms?: number) => Promise<void>;
  setHover: (id: string | null) => void;
  select: (id: string | null) => void;
  zoomBy: (factor: number) => void;
  fit: () => void;
  setChromeVisible: (on: boolean) => void;
  setBadge: (text: string) => void;
  hubId: () => string;
}

declare global {
  interface Window {
    __WIKI_GRAPH_HARNESS__?: HarnessApi;
  }
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let left = n;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function mount(): HarnessApi {
  const root = document.getElementById("harness-root");
  const canvas = document.getElementById("graph-canvas") as HTMLCanvasElement | null;
  const mini = document.getElementById("mini-canvas") as HTMLCanvasElement | null;
  const badge = document.getElementById("harness-badge");
  const chrome = document.getElementById("graph-chrome");
  if (!root || !canvas) throw new Error("harness DOM missing (#harness-root / #graph-canvas)");

  const fixture = buildFixture({ nodeCount: 100, communities: 6 });
  const engine = new GraphEngine(canvas, {
    nodes: fixture.nodes,
    edges: fixture.edges,
    mini: mini ?? null,
    dotGrid: true,
  });
  engine.start(true);

  const api: HarnessApi = {
    engine,
    canvas,
    root,
    fixture,
    ready: true,
    async settle(ms = 900) {
      engine.wake();
      engine.fit(false);
      await new Promise<void>((r) => setTimeout(r, ms));
      engine.wake();
      await waitFrames(24);
    },
    setHover(id) {
      engine.hoverId = id;
      engine.wake();
    },
    select(id) {
      engine.select(id);
    },
    zoomBy(factor) {
      engine.zoomBy(factor);
    },
    fit() {
      engine.fit(false);
    },
    setChromeVisible(on) {
      if (chrome) chrome.hidden = !on;
    },
    setBadge(text) {
      if (badge) badge.textContent = text;
    },
    hubId() {
      return "n0";
    },
  };

  window.__WIKI_GRAPH_HARNESS__ = api;
  document.documentElement.dataset.harnessReady = "1";
  return api;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mount());
} else {
  mount();
}
