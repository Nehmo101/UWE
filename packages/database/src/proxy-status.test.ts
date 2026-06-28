import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProxyStatus } from "./system-status";

describe("proxy status for split-hostname deployments", () => {
  it("reports root paths and cloudflare summary without legacy /studio /portal mounts", () => {
    const proxy = getProxyStatus({
      PUBLIC_APP_URL: "https://uweanddragons.org",
      NEXT_PUBLIC_PORTAL_URL: "https://uweanddragons.org",
      NEXT_PUBLIC_STUDIO_URL: "https://studio.uweanddragons.org",
      TRUST_PROXY: "true",
      CLOUDFLARE_TUNNEL: "true",
      CLOUDFLARE_ACCESS_ENABLED: "true",
      STUDIO_ACCESS_ALLOWED_EMAILS: "owner@example.org",
      AUTH_REQUIRED: "true",
    });

    assert.equal(proxy.deploymentModel, "split-hostname");
    assert.equal(proxy.studioPath, "/");
    assert.equal(proxy.portalPath, "/");
    assert.equal(proxy.studioUrl, "https://studio.uweanddragons.org");
    assert.equal(proxy.portalUrl, "https://uweanddragons.org");
    assert.equal(proxy.cloudflare.tunnelConfigured, true);
    assert.equal(proxy.cloudflare.accessEnabled, true);
    assert.equal(proxy.cloudflare.allowlistConfigured, true);
    assert.equal(proxy.cloudflare.studioOnSeparateHost, true);
    assert.equal(proxy.cloudflare.portalUrlMatchesPublicBase, true);
  });
});
