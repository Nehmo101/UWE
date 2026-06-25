import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export interface PerfResultEntry {
  route: string;
  lcp?: number;
  fcp?: number;
  load?: number;
}

const RESULTS_PATH = path.resolve(process.cwd(), process.env.PERF_RESULTS ?? "perf-results.json");

/**
 * Collects coarse Web Vitals for the current page: Largest Contentful Paint,
 * First Contentful Paint, and the navigation load duration as a TTI proxy.
 */
export async function measureWebVitals(page: Page): Promise<Omit<PerfResultEntry, "route">> {
  return page.evaluate(
    () =>
      new Promise<{ lcp?: number; fcp?: number; load?: number }>((resolve) => {
        const data: { lcp?: number; fcp?: number; load?: number } = {};

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              data.lcp = entry.startTime;
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // LCP not supported — leave undefined
        }

        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        if (fcp) data.fcp = fcp.startTime;

        const nav = performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined;
        if (nav) data.load = nav.duration || nav.loadEventEnd;

        // Allow the LCP observer to settle before resolving.
        setTimeout(() => resolve(data), 1000);
      }),
  );
}

/** Appends one measured route to the shared perf-results.json (serial e2e). */
export function recordPerfResult(entry: PerfResultEntry): void {
  let existing: PerfResultEntry[] = [];
  if (fs.existsSync(RESULTS_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) as PerfResultEntry[];
    } catch {
      existing = [];
    }
  }
  existing = existing.filter((item) => item.route !== entry.route);
  existing.push(entry);
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(existing, null, 2)}\n`);
}
