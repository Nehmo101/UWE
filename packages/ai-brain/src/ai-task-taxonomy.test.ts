import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { AI_TASK_LABELS, JSON_RESULT_TASKS, instructionDemandsJson, requiresJsonResult } from "./tasks";
import { BRAIN_ACTIONS, BRAIN_ACTION_LIST } from "./actions";
import { workflowSlotForTask } from "./router/providers/connectorQueueProvider";
import { mapTaskToUseCase } from "@uwe/cookbook";
import type { AiTaskType } from "./types";

/**
 * The AI task taxonomy lives in nine files, and only seven of them are held
 * together by the compiler.
 *
 * The two that are not are `packages/cookbook/src/ai-types.ts` (a hand copy —
 * `@uwe/cookbook` keeps an empty `dependencies` block on purpose and therefore
 * cannot import the type) and its `routing-hints.ts`, whose map is `Partial<>`
 * and so accepts a key that no longer exists without a murmur. That is exactly
 * how the four Atlas tasks survived the Atlas teardown: deleting them in
 * `@uwe/security` produced three compiler errors in `@uwe/ai-brain` and ZERO in
 * `@uwe/cookbook`, and the dead entries sat there until someone read the file.
 *
 * This test closes that hole from the outside. It reads the two type unions as
 * TEXT — the compiler cannot compare them, so a parser has to — and checks the
 * runtime maps against the same set. Adding, removing or renaming a task in one
 * file now fails here until every file agrees.
 *
 * The nine files, and what holds each one:
 *   1. security/…/ai-context-types.ts      — `AiTaskType`, source of truth       [text, here]
 *   2. cookbook/src/ai-types.ts            — `CookbookAiTaskType` hand copy      [text, here]
 *   3. cookbook/src/routing-hints.ts       — `TASK_TO_USE_CASE` (Partial)        [runtime, here]
 *   4. ai-brain/src/actions.ts             — `BrainActionId`, `BRAIN_ACTIONS`    [compiler + here]
 *   5. ai-brain/src/tasks.ts               — labels + instructions (exhaustive)  [compiler + here]
 *   6. ai-brain/src/router/…/connectorQueueProvider.ts — slot map (exhaustive)   [compiler + here]
 *   7. ai-brain/src/proposals.ts           — per-action branches                 [orphan scan]
 *   8. ai-brain/src/brain-actions.test.ts  — catalog assertions                  [orphan scan]
 *   9. security/src/schemas/common.ts      — comment only                        [orphan scan]
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PACKAGES = join(HERE, "..", "..");
const REPO = join(PACKAGES, "..");

const SECURITY_TYPES = join(
  PACKAGES,
  "security/src/security/inference/ai-context-types.ts",
);
const COOKBOOK_TYPES = join(PACKAGES, "cookbook/src/ai-types.ts");

/**
 * Members of a string-literal union declared as `export type Name = | "a" | "b";`.
 * Reads only until the terminating semicolon, so a later union in the same file
 * is not swallowed.
 */
function unionMembers(path: string, typeName: string): string[] {
  const text = readFileSync(path, "utf8");
  const start = text.indexOf(`export type ${typeName} =`);
  assert.notEqual(start, -1, `${typeName} not found in ${path}`);
  const end = text.indexOf(";", start);
  assert.notEqual(end, -1, `${typeName} in ${path} has no terminating semicolon`);
  const body = text.slice(start, end);
  return [...body.matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
}

const SOURCE_OF_TRUTH = unionMembers(SECURITY_TYPES, "AiTaskType");
const COOKBOOK_COPY = unionMembers(COOKBOOK_TYPES, "CookbookAiTaskType");

/** Ids that must not survive anywhere in the workspace, in any spelling. */
const RETIRED_IDS = [
  "atlas_name_regions",
  "atlas_name_region",
  "atlas_describe_region",
  "atlas_fill_area",
  "atlas_generate_asset_proposal",
  "atlas_draft_names",
  "atlas_region_description",
  "atlas_plot_fill",
  "atlas_asset_proposal",
] as const;

const SCAN_ROOTS = ["packages", "apps", "e2e"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs"]);
const SCAN_SKIP = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "generated",
  "src-tauri",
]);

/**
 * Comments are stripped before the orphan scan. The retired ids are named on
 * purpose in a few places — the rename note in `ai-context-types.ts`, the
 * teardown note in `proposal-validators/index.ts` — and a guard that forbids
 * writing down what was removed would push exactly the history a reader needs
 * out of the code. Naive on purpose: a `//` inside a string literal truncates
 * that line, which cannot hide a task id (they never live in URLs).
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

async function collectSourceFiles(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SCAN_SKIP.has(entry.name)) continue;
      await collectSourceFiles(full, out);
      continue;
    }
    if (SCAN_EXTENSIONS.has(extname(entry.name))) out.push(full);
  }
  return out;
}

describe("AI task taxonomy stays identical across every file that declares it", () => {
  it("the cookbook hand copy matches the security source of truth exactly", () => {
    const source = new Set(SOURCE_OF_TRUTH);
    const copy = new Set(COOKBOOK_COPY);

    const missing = [...source].filter((task) => !copy.has(task));
    const extra = [...copy].filter((task) => !source.has(task));

    assert.deepEqual(
      missing,
      [],
      `packages/cookbook/src/ai-types.ts is missing: ${missing.join(", ")}`,
    );
    assert.deepEqual(
      extra,
      [],
      `packages/cookbook/src/ai-types.ts still carries retired tasks: ${extra.join(", ")}`,
    );
    // Sanity: the parser found a real union, not an empty match.
    assert.ok(source.size > 20, "AiTaskType union parsed as suspiciously small");
  });

  it("declares each task exactly once per file", () => {
    assert.equal(new Set(SOURCE_OF_TRUTH).size, SOURCE_OF_TRUTH.length, "duplicate in AiTaskType");
    assert.equal(new Set(COOKBOOK_COPY).size, COOKBOOK_COPY.length, "duplicate in CookbookAiTaskType");
  });

  it("labels every task and routes it to a workflow slot", () => {
    for (const task of SOURCE_OF_TRUTH as AiTaskType[]) {
      assert.ok(AI_TASK_LABELS[task], `no label for ${task}`);
      assert.ok(workflowSlotForTask(task), `no connector workflow slot for ${task}`);
      // Partial map: every task must at least resolve, even if via the default.
      assert.ok(mapTaskToUseCase(task), `no cookbook use case for ${task}`);
    }
  });

  it("binds every Brain action to a task type that exists", () => {
    const known = new Set(SOURCE_OF_TRUTH);
    for (const action of BRAIN_ACTION_LIST) {
      assert.ok(
        known.has(action.taskType),
        `Brain action ${action.id} points at unknown task type ${action.taskType}`,
      );
      assert.equal(BRAIN_ACTIONS[action.id]?.id, action.id, "BRAIN_ACTIONS key/id mismatch");
    }
  });

  it("keeps the JSON task list and the task instructions in agreement", () => {
    for (const task of JSON_RESULT_TASKS) {
      assert.ok(
        instructionDemandsJson(task),
        `${task} is listed as a JSON task but its instruction never demands JSON`,
      );
    }
    for (const task of SOURCE_OF_TRUTH as AiTaskType[]) {
      if (instructionDemandsJson(task)) {
        assert.ok(
          requiresJsonResult(task),
          `${task} demands JSON in its instruction but is missing from JSON_RESULT_TASKS — ` +
            "it would get neither structured output nor a repair attempt",
        );
      }
    }
  });

  it("leaves no retired Atlas action id anywhere in packages, apps or e2e", async () => {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
      await collectSourceFiles(join(REPO, root), files);
    }
    assert.ok(files.length > 500, `scan found only ${files.length} files — path wrong?`);

    const selfPath = fileURLToPath(import.meta.url);
    const offenders: string[] = [];
    for (const file of files) {
      if (file === selfPath) continue; // the list itself lives here
      const text = stripComments(readFileSync(file, "utf8"));
      for (const id of RETIRED_IDS) {
        // Word boundary so `atlas_name_region` does not also match inside
        // `atlas_name_regions` and report the same line twice.
        if (new RegExp(`\\b${id}\\b`).test(text)) {
          offenders.push(`${file.slice(REPO.length + 1)} → ${id}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `retired Atlas ids still referenced:\n${offenders.join("\n")}`,
    );
  });
});
