import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getControlMeta, isValidAction } from "./control";

describe("host command center control", () => {
  it("recognises update-uwe as a valid action", () => {
    assert.equal(isValidAction("update-uwe"), true);
    assert.equal(isValidAction("restart-uwe"), true);
    assert.equal(isValidAction("nope"), false);
  });

  it("lists Update UWE in control metadata", async () => {
    const meta = await getControlMeta();
    const update = meta.actions.find((action) => action.id === "update-uwe");
    assert.ok(update);
    assert.equal(update.label, "Update UWE");
    assert.equal(update.dangerous, true);
  });
});
