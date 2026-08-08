/**
 * Browser entry for the Wiki-Graph AAA *real* GraphView chrome capture.
 * Bundled via esbuild into graphview-bundle.mjs — mounts the production
 * `<GraphView>` React tree (not the harness.html mockup).
 */

import { createRoot } from "react-dom/client";
import { GraphView } from "../../packages/shared-ui/src/GraphView";
import { buildFixture } from "./fixture-graph";

export interface ReactChromeApi {
  ready: boolean;
  hubId: () => string;
  /** Click the real Nachbarschaft control (same path a user would take). */
  enableNeighborhood: () => Promise<boolean>;
  /** Wait until the live counts line mentions "von" (ego-net active). */
  waitForNeighborhoodChrome: (timeoutMs?: number) => Promise<boolean>;
}

declare global {
  interface Window {
    __WIKI_GRAPH_REACT__?: ReactChromeApi;
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

function mount(): ReactChromeApi {
  const rootEl = document.getElementById("react-chrome-root");
  if (!rootEl) throw new Error("missing #react-chrome-root");

  const fixture = buildFixture({ nodeCount: 100, communities: 6 });
  const hubId = "n0";

  createRoot(rootEl).render(
    <GraphView
      nodes={fixture.nodes}
      edges={fixture.edges}
      worldName="AAA Fixture"
      focusPageId={hubId}
      height={800}
      showMinimap
    />,
  );

  const api: ReactChromeApi = {
    ready: true,
    hubId: () => hubId,
    async enableNeighborhood() {
      // Prefer the inactive toggle (aria-pressed=false); fall back to any
      // Nachbarschaft chip if the control already flipped.
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn =
        buttons.find(
          (el) =>
            el.getAttribute("aria-pressed") === "false" &&
            /Nachbarschaft/.test(el.textContent ?? ""),
        ) ??
        buttons.find((el) => /Nachbarschaft/.test(el.textContent ?? ""));
      if (!btn) return false;
      if (btn.getAttribute("aria-pressed") !== "true") {
        btn.click();
        // Engine rebuilds on localMode flip — give React + GraphEngine a beat.
        await waitFrames(12);
        await new Promise<void>((r) => setTimeout(r, 500));
      }
      // Live "X von Y Knoten" only appears when a category chip filters the
      // current view (ego-net totals become the new baseline). Hide Handout
      // if present so the counts line uses the von-form the critic asked for.
      const handout = Array.from(document.querySelectorAll("button")).find(
        (el) =>
          el.getAttribute("aria-pressed") === "true" &&
          /^Handout/i.test((el.textContent || "").trim()),
      );
      if (handout) {
        handout.click();
        await waitFrames(8);
        await new Promise<void>((r) => setTimeout(r, 200));
      }
      return true;
    },
    async waitForNeighborhoodChrome(timeoutMs = 12_000) {
      const start = performance.now();
      while (performance.now() - start < timeoutMs) {
        const body = document.body.innerText;
        const hasAnchor = /Nachbarschaft:\s*\S/.test(body);
        const hasCounts = /\d+\s+von\s+\d+\s+Knoten/.test(body);
        const hasDepth = /Tiefe/i.test(body);
        if (hasAnchor && hasCounts && hasDepth) return true;
        await waitFrames(8);
      }
      return false;
    },
  };

  window.__WIKI_GRAPH_REACT__ = api;
  document.documentElement.dataset.reactChromeReady = "1";
  return api;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mount());
} else {
  mount();
}
