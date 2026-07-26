import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveRequestOrigin, resolveWebAuthnRelyingParty } from "./webauthn-config";

describe("resolveWebAuthnRelyingParty", () => {
  it("uses the registrable parent domain in split-hostname deployments", () => {
    const rp = resolveWebAuthnRelyingParty({
      env: {
        PUBLIC_BASE_URL: "https://uwe.example",
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://portal.uwe.example",
        SESSION_COOKIE_DOMAIN: ".uwe.example",
      } as NodeJS.ProcessEnv,
    });

    assert.equal(rp.rpId, "uwe.example");
    assert.ok(rp.origins.includes("https://studio.uwe.example"));
    assert.ok(rp.origins.includes("https://portal.uwe.example"));
  });

  it("falls back to the studio hostname when no cookie domain is set", () => {
    const rp = resolveWebAuthnRelyingParty({
      env: {
        PUBLIC_BASE_URL: "https://uwe.example",
        NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
        NEXT_PUBLIC_PORTAL_URL: "https://portal.uwe.example",
      } as NodeJS.ProcessEnv,
    });

    assert.equal(rp.rpId, "studio.uwe.example");
  });

  it("uses the public hostname in unified-path deployments", () => {
    const rp = resolveWebAuthnRelyingParty({
      env: { PUBLIC_BASE_URL: "https://uwe.example" } as NodeJS.ProcessEnv,
    });

    assert.equal(rp.rpId, "uwe.example");
    assert.ok(rp.origins.includes("https://uwe.example"));
  });

  it("derives the RP ID from the request host in local deployments", () => {
    const env = {} as NodeJS.ProcessEnv;

    const viaLocalhost = resolveWebAuthnRelyingParty({
      env,
      requestOrigin: "http://localhost:3000",
    });
    assert.equal(viaLocalhost.rpId, "localhost");
    assert.ok(viaLocalhost.origins.includes("http://localhost:3000"));

    const viaLoopbackIp = resolveWebAuthnRelyingParty({
      env,
      requestOrigin: "http://127.0.0.1:3199",
    });
    assert.equal(viaLoopbackIp.rpId, "127.0.0.1");
  });
});

describe("deriveRequestOrigin", () => {
  it("prefers the Origin header", () => {
    const request = new Request("http://internal/api", {
      headers: { origin: "https://studio.uwe.example", host: "ignored.example" },
    });
    assert.equal(deriveRequestOrigin(request), "https://studio.uwe.example");
  });

  it("falls back to host + forwarded proto", () => {
    const request = new Request("http://internal/api", {
      headers: { host: "studio.uwe.example", "x-forwarded-proto": "https" },
    });
    assert.equal(deriveRequestOrigin(request), "https://studio.uwe.example");
  });
});
