import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getControlMeta, isValidAction, resetControlTokenCacheForTests, resolveControlToken } from "./control";

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

  it("resolves a token when the default token file is not writable", async () => {
    const previousFile = process.env.HOST_COMMAND_CENTER_TOKEN_FILE;
    const previousToken = process.env.HOST_COMMAND_CENTER_TOKEN;
    process.env.HOST_COMMAND_CENTER_TOKEN_FILE = "/root/forbidden/host-command-center.token";
    delete process.env.HOST_COMMAND_CENTER_TOKEN;
    resetControlTokenCacheForTests();

    try {
      const token = await resolveControlToken();
      assert.ok(token.length >= 16);
    } finally {
      resetControlTokenCacheForTests();
      if (previousFile === undefined) delete process.env.HOST_COMMAND_CENTER_TOKEN_FILE;
      else process.env.HOST_COMMAND_CENTER_TOKEN_FILE = previousFile;
      if (previousToken === undefined) delete process.env.HOST_COMMAND_CENTER_TOKEN;
      else process.env.HOST_COMMAND_CENTER_TOKEN = previousToken;
    }
  });
});
