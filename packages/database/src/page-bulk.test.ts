import test from "node:test";
import assert from "node:assert/strict";
import { addTagsTo, removeTagsFrom } from "./page-bulk-service";

test("addTagsTo appends new tags without duplicates (case-insensitive)", () => {
  assert.deepEqual(addTagsTo(["Wichtig"], ["neu", "wichtig"]), ["Wichtig", "neu"]);
  assert.deepEqual(addTagsTo([], ["a", "b", "a"]), ["a", "b"]);
  assert.deepEqual(addTagsTo(["a"], ["  b  ", ""]), ["a", "b"]);
});

test("addTagsTo keeps the original order stable", () => {
  assert.deepEqual(addTagsTo(["z", "a"], ["m"]), ["z", "a", "m"]);
});

test("removeTagsFrom removes matching tags case-insensitively", () => {
  assert.deepEqual(removeTagsFrom(["Wichtig", "NPC", "Ort"], ["npc"]), ["Wichtig", "Ort"]);
  assert.deepEqual(removeTagsFrom(["a", "b"], ["c"]), ["a", "b"]);
  assert.deepEqual(removeTagsFrom(["a", "b"], ["a", "b"]), []);
});
