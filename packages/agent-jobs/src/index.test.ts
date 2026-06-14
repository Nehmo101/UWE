import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAgentJobsDispatchConfig } from "./index";

describe("resolveAgentJobsDispatchConfig", () => {
  it("uses default workflow name", () => {
    const config = resolveAgentJobsDispatchConfig({});
    assert.equal(config.githubWorkflow, "cursor-agent.yml");
    assert.equal(config.defaultBranch, "main");
  });
});
