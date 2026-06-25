import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOCUSABLE_SELECTOR } from "./useFocusTrap";

describe("useFocusTrap helpers", () => {
  it("exports the CommandPalette focusable selector", () => {
    assert.match(FOCUSABLE_SELECTOR, /button/);
    assert.match(FOCUSABLE_SELECTOR, /\[href\]/);
    assert.match(FOCUSABLE_SELECTOR, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
  });
});
