import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSystemOwner } from "./owner-auth";

describe("portal owner auth", () => {
  it("treats global owner as system administrator", () => {
    assert.equal(isSystemOwner("owner"), true);
    assert.equal(isSystemOwner("dm"), false);
    assert.equal(isSystemOwner("player"), false);
    assert.equal(isSystemOwner(null), false);
  });
});
