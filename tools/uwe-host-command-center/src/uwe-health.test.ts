import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { brainQuickLink } from "./uwe-health.ts";
import { SERVICE_PORT_ENV } from "./desktop-host-types.ts";

/**
 * Der Brain-Quick-Link des Dashboards muss auf den Port zeigen, auf dem Brain
 * laut `.env` wirklich läuft. Historischer Fehler: hier stand `3002` hart im
 * Code, während `buildLocalHostEnv` bei der Ersteinrichtung `BRAIN_PORT=3102`
 * schreibt — der Link zeigte auf solchen Hosts ins Leere.
 */

const ENV_KEYS = ["BRAIN_PORT", "BRAIN_EXPOSURE", "BRAIN_PATH", "NEXT_PUBLIC_BRAIN_URL"] as const;
let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Brain-Quick-Link: Portauflösung", () => {
  it("liest BRAIN_PORT aus der Umgebung — wie die Studio-/Portal-Probes", () => {
    process.env.BRAIN_PORT = "3102";

    assert.equal(brainQuickLink()?.href, "http://127.0.0.1:3102/life-brain");
  });

  it("fällt ohne BRAIN_PORT auf die zentrale Wahrheit SERVICE_PORT_ENV zurück", () => {
    const link = brainQuickLink();

    assert.equal(link?.href, `http://127.0.0.1:${SERVICE_PORT_ENV.brain.fallback}/life-brain`);
  });

  it("behandelt einen kaputten BRAIN_PORT wie einen fehlenden", () => {
    process.env.BRAIN_PORT = "dreitausend";

    assert.equal(brainQuickLink()?.href, `http://127.0.0.1:${SERVICE_PORT_ENV.brain.fallback}/life-brain`);
  });

  it("lässt eine explizite NEXT_PUBLIC_BRAIN_URL weiterhin gewinnen", () => {
    process.env.BRAIN_PORT = "3102";
    process.env.NEXT_PUBLIC_BRAIN_URL = "http://127.0.0.1:4002/";
    process.env.BRAIN_PATH = "/brain";

    assert.equal(brainQuickLink()?.href, "http://127.0.0.1:4002/brain");
  });

  it("bleibt bei BRAIN_EXPOSURE=off unsichtbar", () => {
    process.env.BRAIN_EXPOSURE = "off";
    process.env.BRAIN_PORT = "3102";

    assert.equal(brainQuickLink(), null);
  });
});
