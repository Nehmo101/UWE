import assert from "node:assert/strict";
import test from "node:test";
import { MAX_OCR_PAGES, planOcrPages } from "./plan";

test("gruppiert Seiten in Jobs", () => {
  const plan = planOcrPages(10, { pagesPerJob: 4 });

  assert.deepEqual(plan.pages, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(plan.batches, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10]]);
  assert.equal(plan.truncated, false);
});

test("schneidet über dem Cap ab und meldet es", () => {
  const plan = planOcrPages(300, { maxPages: 120 });

  assert.equal(plan.pages.length, 120);
  assert.equal(plan.truncated, true);
  assert.equal(plan.totalPages, 300);
  assert.equal(plan.skippedPages, 180);
});

test("leeres PDF ergibt einen leeren Plan statt eines Fehlers", () => {
  const plan = planOcrPages(0);

  assert.deepEqual(plan.pages, []);
  assert.deepEqual(plan.batches, []);
  assert.equal(plan.truncated, false);
});

test("jede geplante Seite landet in genau einem Batch", () => {
  const plan = planOcrPages(MAX_OCR_PAGES);
  const flattened = plan.batches.flat();

  assert.deepEqual(flattened, plan.pages);
  assert.equal(new Set(flattened).size, flattened.length);
});
