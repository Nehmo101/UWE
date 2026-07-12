import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateProgress,
  parseLogLines,
  type HostUpdateState,
} from "./host-update-progress";

describe("host update progress", () => {
  it("parses timestamped log lines", () => {
    const lines = parseLogLines(
      "[2026-07-09T10:15:00+02:00] Host-Update gestartet\n"
      + "[2026-07-09T10:15:05+02:00] git fetch origin main ...\n"
      + "@uwe/studio:build: Compiling\n",
    );
    assert.equal(lines.length, 3);
    assert.equal(lines[0].timestamp, "2026-07-09T10:15:00+02:00");
    assert.equal(lines[0].message, "Host-Update gestartet");
    assert.equal(lines[2].timestamp, null);
    assert.match(lines[2].message, /Compiling/);
  });

  it("estimates git sync phase", () => {
    const state: HostUpdateState = {
      jobId: "job-1",
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      startedByUserId: null,
      exitCode: null,
      commitBefore: null,
      commitAfter: null,
      error: null,
    };
    const log = "[2026-07-09T10:15:00+02:00] Synchronisiere Repository mit origin/main ...\n"
      + "[2026-07-09T10:15:02+02:00] git fetch origin main ...";
    const estimate = estimateProgress(state, log);
    assert.equal(estimate.phaseLabel, "git fetch origin main");
    assert.ok(estimate.progressPercent >= 10 && estimate.progressPercent <= 20);
  });

  it("estimates build phase from turbo output", () => {
    const state: HostUpdateState = {
      jobId: "job-1",
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      startedByUserId: null,
      exitCode: null,
      commitBefore: null,
      commitAfter: null,
      error: null,
    };
    const log = "[2026-07-09T10:20:00+02:00] setup-uwe-host.sh --quick …\n"
      + "@uwe/studio:build: Linting and checking validity of types ...";
    const estimate = estimateProgress(state, log);
    assert.equal(estimate.phaseLabel, "Typen prüfen");
    assert.ok(estimate.progressPercent >= 80);
  });

  it("reports 100% when succeeded", () => {
    const state: HostUpdateState = {
      jobId: "job-1",
      status: "succeeded",
      startedAt: "2026-07-09T10:00:00.000Z",
      finishedAt: "2026-07-09T10:25:00.000Z",
      startedByUserId: null,
      exitCode: 0,
      commitBefore: null,
      commitAfter: "abc",
      error: null,
    };
    const estimate = estimateProgress(state, "");
    assert.equal(estimate.progressPercent, 100);
    assert.equal(estimate.phaseLabel, "Abgeschlossen");
  });

  it("ignores success markers from previous runs in the same log", () => {
    const state: HostUpdateState = {
      jobId: "job-new",
      status: "running",
      startedAt: "2026-07-12T10:00:00.000Z",
      finishedAt: null,
      startedByUserId: null,
      exitCode: null,
      commitBefore: null,
      commitAfter: null,
      error: null,
    };
    const log = "[2026-07-11T08:00:00+02:00] Host-Update erfolgreich abgeschlossen.\n"
      + "[2026-07-12T12:00:05+02:00] Host-Update gestartet (Job job-new, unit uwe-host-update.service).\n"
      + "@uwe/studio:build: Compiling";
    const estimate = estimateProgress(state, log);
    assert.equal(estimate.phaseLabel, "Kompilieren");
    assert.ok(estimate.progressPercent < 100);
  });

  it("reports pending state", () => {
    const state: HostUpdateState = {
      jobId: "job-1",
      status: "pending",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      startedByUserId: null,
      exitCode: null,
      commitBefore: null,
      commitAfter: null,
      error: null,
    };
    const estimate = estimateProgress(state, "");
    assert.equal(estimate.progressPercent, 2);
    assert.equal(estimate.phaseLabel, "Wartet auf systemd");
  });
});
