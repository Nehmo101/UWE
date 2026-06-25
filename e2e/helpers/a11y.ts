import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import type { Result } from "axe-core";

/** WCAG 2.x Level A + AA rules — fast smoke scope for page-level scans. */
const SMOKE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

export type A11yViolationSummary = {
  id: string;
  impact: Result["impact"];
  description: string;
  help: string;
  nodes: string[];
};

export function summarizeViolations(violations: Result[]): A11yViolationSummary[] {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.html).slice(0, 3),
  }));
}

export async function expectNoA11yViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...SMOKE_TAGS]).analyze();
  const summary = summarizeViolations(results.violations);

  expect(
    summary,
    `${label}: axe-core found ${summary.length} violation(s):\n${JSON.stringify(summary, null, 2)}`,
  ).toEqual([]);
}
