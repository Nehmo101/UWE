import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planImapSync, buildUidFetchChunks } from "./sync-plan";

describe("planImapSync", () => {
  it("does a full sync on first run (no stored validity / lastSeenUid 0)", () => {
    const plan = planImapSync({
      serverUidValidity: "10",
      storedUidValidity: null,
      lastSeenUid: 0,
      serverUids: [3, 1, 2],
    });
    assert.equal(plan.mode, "full");
    assert.deepEqual(plan.uidsToFetch, [1, 2, 3]);
    assert.equal(plan.newLastSeenUid, 3);
    assert.deepEqual(plan.uidsToDelete, []);
  });

  it("caps a full sync to the most recent `limit` UIDs", () => {
    const plan = planImapSync({
      serverUidValidity: "10",
      storedUidValidity: null,
      lastSeenUid: 0,
      serverUids: [1, 2, 3, 4, 5],
      limit: 2,
    });
    assert.deepEqual(plan.uidsToFetch, [4, 5]);
    assert.equal(plan.newLastSeenUid, 5);
  });

  it("fetches only new UIDs on an incremental run", () => {
    const plan = planImapSync({
      serverUidValidity: "10",
      storedUidValidity: "10",
      lastSeenUid: 3,
      serverUids: [1, 2, 3, 4, 5],
    });
    assert.equal(plan.mode, "incremental");
    assert.deepEqual(plan.uidsToFetch, [4, 5]);
    assert.equal(plan.newLastSeenUid, 5);
  });

  it("forces a full resync when UIDVALIDITY changes", () => {
    const plan = planImapSync({
      serverUidValidity: "99",
      storedUidValidity: "10",
      lastSeenUid: 3,
      serverUids: [1, 2, 3],
    });
    assert.equal(plan.mode, "full");
    assert.deepEqual(plan.uidsToFetch, [1, 2, 3]);
  });

  it("reports locally-held UIDs that vanished from the server for deletion", () => {
    const plan = planImapSync({
      serverUidValidity: "10",
      storedUidValidity: "10",
      lastSeenUid: 5,
      serverUids: [1, 2, 4, 5],
      localUids: [1, 2, 3, 4, 5],
    });
    assert.deepEqual(plan.uidsToDelete, [3]);
    assert.deepEqual(plan.uidsToFetch, []);
  });
});

describe("buildUidFetchChunks", () => {
  it("compresses consecutive UIDs into ranges", () => {
    assert.deepEqual(buildUidFetchChunks([1, 2, 3, 5, 8, 9]), ["1:3,5,8:9"]);
  });

  it("splits into chunks of at most `chunkSize` UIDs", () => {
    assert.deepEqual(buildUidFetchChunks([1, 2, 3, 4], 2), ["1:2", "3:4"]);
  });

  it("returns no chunks for an empty list", () => {
    assert.deepEqual(buildUidFetchChunks([]), []);
  });
});
