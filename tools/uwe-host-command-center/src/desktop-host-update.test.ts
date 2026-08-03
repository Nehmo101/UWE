import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareSemver,
  parseReleaseTag,
  selectLatestReleaseTag,
} from "./desktop-host-update";

describe("desktop host update helpers", () => {
  it("parses uwe-v release tags", () => {
    assert.deepEqual(parseReleaseTag("uwe-v1.2.3"), { tag: "uwe-v1.2.3", version: "1.2.3" });
    assert.equal(parseReleaseTag("v1.2.3"), null);
    assert.equal(parseReleaseTag("engine-connector-v0.1.0"), null);
  });

  it("compares semver versions", () => {
    assert.equal(compareSemver("0.1.0", "0.1.1"), -1);
    assert.equal(compareSemver("1.0.0", "0.9.9"), 1);
    assert.equal(compareSemver("1.2.3", "1.2.3"), 0);
  });

  it("selects the highest release tag", () => {
    assert.deepEqual(
      selectLatestReleaseTag(["uwe-v0.1.0", "uwe-v0.2.0", "uwe-v0.1.5", "ignore"]),
      { tag: "uwe-v0.2.0", version: "0.2.0" },
    );
    assert.equal(selectLatestReleaseTag(["main", "feature"]), null);
  });
});
