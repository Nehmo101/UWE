import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-expect-error — reines .mjs-Werkzeugmodul ohne Typdeklaration
import { assessRunLocation, normalizeRoute, readLivePorts } from "./verify-ui-guard.mjs";

const LIVE = [3100, 3101, 3102, 3103, 3104];
const VERIFY = [3199, 3200];

describe("assessRunLocation", () => {
  it("verweigert den Start im Haupt-Arbeitsbaum, solange Live-Dienste antworten", () => {
    // Der teure Fall: Der Lauf baut apps/*/.next neu und nimmt damit die
    // laufenden Dienste mit, die aus genau diesem Verzeichnis bedienen.
    const result = assessRunLocation({
      isMainWorktree: true,
      livePorts: LIVE,
      respondingLivePorts: [3100, 3101],
      verifyPorts: VERIFY,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "live-services-in-main-worktree");
    assert.match(result.message, /git worktree add/, "nennt den Ausweg");
  });

  it("erlaubt den Start in einem eigenen Arbeitsbaum, auch wenn Dienste laufen", () => {
    const result = assessRunLocation({
      isMainWorktree: false,
      livePorts: LIVE,
      respondingLivePorts: [3100, 3101, 3102],
      verifyPorts: VERIFY,
    });
    assert.equal(result.allowed, true);
  });

  it("erlaubt den Haupt-Arbeitsbaum, wenn kein Dienst antwortet — mit Hinweis", () => {
    const result = assessRunLocation({
      isMainWorktree: true,
      livePorts: LIVE,
      respondingLivePorts: [],
      verifyPorts: VERIFY,
    });
    assert.equal(result.allowed, true);
    assert.match(result.message, /Hinweis/);
  });

  it("verweigert eine Portüberschneidung, egal wo der Lauf steht", () => {
    const result = assessRunLocation({
      isMainWorktree: false,
      livePorts: LIVE,
      respondingLivePorts: [],
      verifyPorts: [3100, 3200],
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "port-collision");
    assert.match(result.message, /3100/);
  });

  it("wiegt die Portüberschneidung schwerer als den Arbeitsbaum", () => {
    const result = assessRunLocation({
      isMainWorktree: true,
      livePorts: LIVE,
      respondingLivePorts: [3100],
      verifyPorts: [3100],
    });
    assert.equal(result.reason, "port-collision");
  });
});

describe("normalizeRoute", () => {
  it("nimmt eine Route mit führendem Schrägstrich unverändert", () => {
    assert.deepEqual(normalizeRoute("/worlds/terra/kampagnen"), {
      ok: true,
      route: "/worlds/terra/kampagnen",
    });
  });

  it("ergänzt den führenden Schrägstrich", () => {
    assert.deepEqual(normalizeRoute("worlds/terra/kampagnen"), {
      ok: true,
      route: "/worlds/terra/kampagnen",
    });
  });

  it("erkennt eine von Git Bash verunstaltete Route", () => {
    // Genau so ist der erste echte Lauf am 2026-08-05 gescheitert.
    const result = normalizeRoute("C:/Program Files/Git/worlds/terra/dashboard");
    assert.equal(result.ok, false);
    assert.match(result.message, /Git Bash/);
    assert.match(result.message, /MSYS_NO_PATHCONV/);
  });

  it("weist eine leere Route zurück", () => {
    assert.equal(normalizeRoute("   ").ok, false);
  });
});

describe("readLivePorts", () => {
  it("liest die Dienst-Ports aus einer .env", () => {
    const ports = readLivePorts(
      ["# Kommentar", "STUDIO_PORT=3100", "PORTAL_PORT=3101", "BRAIN_PORT=3102", "FAMILY_PORT=3104"].join("\n"),
    );
    assert.deepEqual(ports, [3100, 3101, 3102, 3104]);
  });

  it("übergeht auskommentierte Zeilen und fehlende Schlüssel", () => {
    const ports = readLivePorts(["#STUDIO_PORT=3100", "PORTAL_PORT=3101"].join("\n"));
    assert.deepEqual(ports, [3101]);
  });

  it("kommt mit einer leeren Datei zurecht", () => {
    assert.deepEqual(readLivePorts(""), []);
  });
});
