import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BACKUP_QUERY_BATCH_SIZE, loadInBatches } from "./batch";

describe("backup query batching", () => {
  it("splits large ID collections without losing their order or values", async () => {
    const values = Array.from(
      { length: BACKUP_QUERY_BATCH_SIZE * 3 + 17 },
      (_, index) => `page-${index}`,
    );
    const seenBatchSizes: number[] = [];

    const loaded = await loadInBatches(values, async (batch) => {
      seenBatchSizes.push(batch.length);
      return batch.map((id) => ({ id }));
    });

    assert.deepEqual(
      seenBatchSizes,
      [BACKUP_QUERY_BATCH_SIZE, BACKUP_QUERY_BATCH_SIZE, BACKUP_QUERY_BATCH_SIZE, 17],
    );
    assert.deepEqual(
      loaded.map((entry) => entry.id),
      values,
    );
  });

  it("does not issue a query for an empty collection", async () => {
    let called = false;
    const loaded = await loadInBatches([], async () => {
      called = true;
      return [];
    });

    assert.deepEqual(loaded, []);
    assert.equal(called, false);
  });
});
