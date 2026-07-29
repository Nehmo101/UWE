import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  defaultInstallSelection,
  installSelectionFile,
  isAppSelected,
  normalizeInstallSelection,
  readInstallSelectionState,
  writeInstallSelection,
} from "./install-selection";
import { buildSetupPlan, setupStepCount } from "./setup-plan";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-install-selection-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("install selection", () => {
  it("defaults to every app so pre-wizard installations keep their behaviour", () => {
    const dataRoot = temporaryDirectory();
    const state = readInstallSelectionState(dataRoot);

    assert.equal(state.persisted, false);
    assert.deepEqual(state.selection.apps, ["studio", "portal", "brain", "family", "landing"]);
    assert.equal(state.selection.seedDemoContent, true);
  });

  it("persists a selection and reports it as written", () => {
    const dataRoot = temporaryDirectory();
    const written = writeInstallSelection(dataRoot, { apps: ["studio", "brain"], seedDemoContent: false });

    assert.deepEqual(written.apps, ["studio", "brain"]);
    assert.equal(written.seedDemoContent, false);
    assert.ok(written.updatedAt);

    const state = readInstallSelectionState(dataRoot);
    assert.equal(state.persisted, true);
    assert.deepEqual(state.selection.apps, ["studio", "brain"]);
    assert.equal(state.file, installSelectionFile(dataRoot));
  });

  it("orders apps by the service order, not by input order", () => {
    const selection = normalizeInstallSelection({ apps: ["landing", "brain", "studio"] });
    assert.deepEqual(selection.apps, ["studio", "brain", "landing"]);
  });

  it("ignores unknown app ids and falls back when nothing valid remains", () => {
    assert.deepEqual(normalizeInstallSelection({ apps: ["studio", "nope"] }).apps, ["studio"]);
    assert.deepEqual(normalizeInstallSelection({ apps: [] }).apps, defaultInstallSelection().apps);
    assert.deepEqual(normalizeInstallSelection({ apps: ["nope"] }).apps, defaultInstallSelection().apps);
  });

  it("falls back to the default when the file is corrupt, instead of blocking setup", () => {
    const dataRoot = temporaryDirectory();
    fs.writeFileSync(installSelectionFile(dataRoot), "{ not json", "utf8");

    const state = readInstallSelectionState(dataRoot);
    assert.equal(state.persisted, false);
    assert.deepEqual(state.selection.apps, defaultInstallSelection().apps);
  });
});

describe("setup plan", () => {
  const context = { root: "/srv/uwe", dataRoot: "/var/uwe" };

  it("migrates only the databases the selected apps need", () => {
    const plan = buildSetupPlan(
      normalizeInstallSelection({ apps: ["studio", "portal"] }),
      context,
    );
    const phases = plan.map((step) => step.phase);

    assert.ok(phases.includes("migrate"));
    assert.ok(!phases.includes("migrate-brain"));
    assert.ok(!phases.includes("migrate-family"));
  });

  it("adds the brain and family migrations when those apps are selected", () => {
    const phases = buildSetupPlan(
      normalizeInstallSelection({ apps: ["studio", "brain", "family"] }),
      context,
    ).map((step) => step.phase);

    assert.ok(phases.includes("migrate-brain"));
    assert.ok(phases.includes("migrate-family"));
  });

  it("builds only the selected apps", () => {
    const phases = buildSetupPlan(normalizeInstallSelection({ apps: ["brain"] }), context).map(
      (step) => step.phase,
    );

    assert.deepEqual(
      phases.filter((phase) => phase.endsWith("-build")),
      ["brain-build"],
    );
  });

  it("drops the seed step when demo content is declined", () => {
    const withSeed = buildSetupPlan(defaultInstallSelection(), context);
    const withoutSeed = buildSetupPlan(
      normalizeInstallSelection({ apps: ["studio"], seedDemoContent: false }),
      context,
    );

    assert.ok(withSeed.some((step) => step.kind === "seed"));
    assert.ok(!withoutSeed.some((step) => step.kind === "seed"));
  });

  it("passes the resolved root and data dir to the connector provisioning step", () => {
    const step = buildSetupPlan(defaultInstallSelection(), context).find(
      (entry) => entry.phase === "connector",
    );

    assert.ok(step);
    assert.ok(step.args.includes(context.root));
    assert.equal(step.env?.UWE_COMMAND_CENTER_DATA_DIR, context.dataRoot);
  });

  it("reports a step count that matches the plan it will actually run", () => {
    const selection = normalizeInstallSelection({ apps: ["studio", "portal"] });
    assert.equal(setupStepCount(selection), buildSetupPlan(selection, context).length);
    // Full install: install, prisma, migrate, seed, connector + 5 builds.
    assert.equal(setupStepCount(defaultInstallSelection()), 12);
  });

  it("knows which apps are selected", () => {
    const selection = normalizeInstallSelection({ apps: ["studio", "family"] });
    assert.equal(isAppSelected(selection, "family"), true);
    assert.equal(isAppSelected(selection, "brain"), false);
  });
});
