import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeStudioApiPath, studioApiUrl } from "./studio-api-url";

describe("studioApiUrl", () => {
  it("normalizes API paths", () => {
    assert.equal(normalizeStudioApiPath("/api/jobs/1"), "/api/jobs/1");
    assert.equal(normalizeStudioApiPath("api/jobs/1"), "/api/jobs/1");
    assert.equal(normalizeStudioApiPath("jobs/1"), "/api/jobs/1");
  });

  it("keeps /api paths in direct dev mode", () => {
    assert.equal(studioApiUrl("/api/health", {}), "/api/health");
    assert.equal(
      studioApiUrl("/api/jobs/abc", {
        NEXT_PUBLIC_STUDIO_URL: "http://localhost:3000",
        NEXT_PUBLIC_PORTAL_URL: "http://localhost:3001",
      }),
      "/api/jobs/abc",
    );
  });

  it("prefixes unified layout paths from PUBLIC_BASE_URL", () => {
    assert.equal(
      studioApiUrl("/api/brain/run", {
        PUBLIC_BASE_URL: "https://uwe.example.org",
      }),
      "/studio/api/brain/run",
    );
  });

  it("prefixes when NEXT_PUBLIC_STUDIO_URL includes a path segment", () => {
    assert.equal(
      studioApiUrl("/api/admin/status", {
        NEXT_PUBLIC_STUDIO_URL: "https://uwe.example.org/studio",
        NEXT_PUBLIC_PORTAL_URL: "https://uwe.example.org",
      }),
      "/studio/api/admin/status",
    );
  });

  it("uses NEXT_PUBLIC_STUDIO_API_ORIGIN when configured", () => {
    assert.equal(
      studioApiUrl("/api/backup", {
        NEXT_PUBLIC_STUDIO_API_ORIGIN: "https://uwe.example.org/studio",
      }),
      "https://uwe.example.org/studio/api/backup",
    );
  });

  it("honours NEXT_PUBLIC_STUDIO_PATH without PUBLIC_BASE_URL", () => {
    assert.equal(
      studioApiUrl("/api/worlds", {
        NEXT_PUBLIC_STUDIO_PATH: "/studio",
      }),
      "/studio/api/worlds",
    );
  });
});
