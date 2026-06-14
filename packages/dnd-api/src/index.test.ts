import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("@uwe/dnd-api", () => {
  it("exports search helpers", async () => {
    const mod = await import("./index");
    assert.equal(typeof mod.searchAllDndApis, "function");
    assert.equal(typeof mod.searchOpen5eMonsters, "function");
  });
});
