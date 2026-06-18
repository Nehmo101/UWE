import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fromUweThemePreferences,
  shouldApplyServerPreferences,
  toUweThemePreferences,
} from "./sync";
import { defaultPreferences } from "./storage";

describe("theme sync helpers", () => {
  it("round-trips database and client theme preferences", () => {
    const client = defaultPreferences("studio");
    client.themeId = "terra";
    client.background = "noise";
    const record = fromUweThemePreferences(client);
    const restored = toUweThemePreferences(record, "studio");
    assert.equal(restored.themeId, "terra");
    assert.equal(restored.background, "noise");
  });

  it("applies server preferences when local storage is empty", () => {
    assert.equal(shouldApplyServerPreferences("studio", null), true);
  });

  it("applies server preferences when server timestamp is newer", () => {
  const scope = "studio" as const;
  const key = "uwe-theme-preferences-studio";
  const syncKey = "uwe-theme-sync-at-studio";
  const prev = globalThis.localStorage;
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });
  try {
    store.set(key, JSON.stringify(defaultPreferences(scope)));
    store.set(syncKey, "2026-01-01T00:00:00.000Z");
    assert.equal(
      shouldApplyServerPreferences(scope, "2026-06-18T12:00:00.000Z"),
      true,
    );
    assert.equal(
      shouldApplyServerPreferences(scope, "2025-01-01T00:00:00.000Z"),
      false,
    );
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: prev,
    });
  }
  });
});
