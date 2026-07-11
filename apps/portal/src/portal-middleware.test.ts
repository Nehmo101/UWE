import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function makeRequest(url: string) {
  return new NextRequest(url, { headers: { host: new URL(url).host } });
}

describe("portal middleware legacy redirects", () => {
  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    delete env.NODE_ENV;
    delete env.AUTH_REQUIRED;
    delete env.PUBLIC_APP_URL;
    delete env.STUDIO_URL;
    delete env.PORTAL_URL;
  });

  it("redirects old /studio links to the Studio subdomain", () => {
    process.env.PUBLIC_APP_URL = "https://uweanddragons.org";
    process.env.STUDIO_URL = "https://studio.uweanddragons.org";
    process.env.PORTAL_URL = "https://uweanddragons.org";

    const response = middleware(makeRequest("https://uweanddragons.org/studio/worlds/terra?tab=brain"));

    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://studio.uweanddragons.org/worlds/terra?tab=brain");
  });

  it("redirects old /portal links to canonical Portal routes", () => {
    const response = middleware(makeRequest("https://uweanddragons.org/portal/worlds/terra"));

    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://uweanddragons.org/worlds/terra");
  });

  it("keeps Portal content login-required in production", () => {
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = "production";
    env.AUTH_REQUIRED = "true";
    env.PUBLIC_APP_URL = "https://uweanddragons.org";

    const response = middleware(makeRequest("https://uweanddragons.org/worlds/terra"));

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://uweanddragons.org/login?redirect=%2Fworlds%2Fterra");
  });
});