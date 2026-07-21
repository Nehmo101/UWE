import assert from "node:assert/strict";
import { test } from "node:test";
import { Atlas3DCommandStack, valueCommand } from "./commands";

function makeDoc(): { value: number } {
  return { value: 0 };
}

function setTo(doc: { value: number }, next: number, coalesceKey?: string) {
  return valueCommand({
    label: `Wert auf ${next}`,
    coalesceKey,
    get: () => doc.value,
    set: (v) => {
      doc.value = v;
    },
    next,
  });
}

test("execute/undo/redo round-trips the document", () => {
  const doc = makeDoc();
  const stack = new Atlas3DCommandStack();
  stack.execute(setTo(doc, 1));
  stack.execute(setTo(doc, 2));
  assert.equal(doc.value, 2);
  assert.equal(stack.undoDepth, 2);
  assert.ok(stack.undo());
  assert.equal(doc.value, 1);
  assert.ok(stack.undo());
  assert.equal(doc.value, 0);
  assert.equal(stack.undo(), false);
  assert.ok(stack.redo());
  assert.ok(stack.redo());
  assert.equal(doc.value, 2);
  assert.equal(stack.redoDepth, 0);
});

test("new command clears the redo stack", () => {
  const doc = makeDoc();
  const stack = new Atlas3DCommandStack();
  stack.execute(setTo(doc, 1));
  stack.undo();
  stack.execute(setTo(doc, 5));
  assert.equal(stack.redoDepth, 0);
  assert.equal(doc.value, 5);
});

test("coalesced slider drag is a single undo step back to the pre-drag value", () => {
  const doc = makeDoc();
  const stack = new Atlas3DCommandStack();
  stack.execute(setTo(doc, 10));
  stack.execute(setTo(doc, 11, "gap"));
  stack.execute(setTo(doc, 12, "gap"));
  stack.execute(setTo(doc, 13, "gap"));
  assert.equal(doc.value, 13);
  assert.equal(stack.undoDepth, 2);
  stack.undo();
  assert.equal(doc.value, 10);
});

test("sealCoalescing starts a fresh step for the same key", () => {
  const doc = makeDoc();
  const stack = new Atlas3DCommandStack();
  stack.execute(setTo(doc, 1, "gap"));
  stack.sealCoalescing();
  stack.execute(setTo(doc, 2, "gap"));
  assert.equal(stack.undoDepth, 2);
  stack.undo();
  assert.equal(doc.value, 1);
});

test("capacity drops oldest entries", () => {
  const doc = makeDoc();
  const stack = new Atlas3DCommandStack({ capacity: 2 });
  stack.execute(setTo(doc, 1));
  stack.execute(setTo(doc, 2));
  stack.execute(setTo(doc, 3));
  assert.equal(stack.undoDepth, 2);
  stack.undo();
  stack.undo();
  assert.equal(doc.value, 1);
});

test("onChange fires for execute, undo and redo", () => {
  const doc = makeDoc();
  let calls = 0;
  const stack = new Atlas3DCommandStack({ onChange: () => calls++ });
  stack.execute(setTo(doc, 1));
  stack.undo();
  stack.redo();
  assert.equal(calls, 3);
});
