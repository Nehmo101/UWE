import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessApiOrigin,
  isCrossSiteBrowserRequest,
  isSameOriginBrowserRequest,
} from "./api-origin-guard";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://studio.local/api/backup", {
    method: "POST",
    headers,
  });
}

describe("API origin guard", () => {
  it("allows same-origin browser requests", () => {
    const request = makeRequest({ "sec-fetch-site": "same-origin", host: "studio.local" });
    assert.equal(isCrossSiteBrowserRequest(request), false);
    assert.equal(isSameOriginBrowserRequest(request), true);
  });

  it("allows non-browser requests without Origin", () => {
    const request = makeRequest({ host: "studio.local" });
    assert.equal(isCrossSiteBrowserRequest(request), false);
    assert.equal(isSameOriginBrowserRequest(request), false);
  });

  it("blocks cross-site browser requests", () => {
    const request = makeRequest({ "sec-fetch-site": "cross-site", host: "studio.local" });
    const assessment = assessApiOrigin(request);
    assert.equal(assessment.blocked, true);
    assert.equal(assessment.reason, "cross-site");
  });

  it("blocks requests with a foreign Origin header", () => {
    const request = makeRequest({ origin: "http://evil.example", host: "studio.local" });
    assert.equal(isCrossSiteBrowserRequest(request), true);
    assert.equal(isSameOriginBrowserRequest(request), false);
  });

  it("allows requests whose Origin matches the host", () => {
    const request = makeRequest({ origin: "http://studio.local", host: "studio.local" });
    assert.equal(isCrossSiteBrowserRequest(request), false);
    assert.equal(isSameOriginBrowserRequest(request), true);
  });

  it("allows explicitly configured CORS origins", () => {
    const env = { ALLOWED_CORS_ORIGINS: "https://partner.example" };
    const request = makeRequest({
      origin: "https://partner.example",
      host: "studio.local",
    });

    assert.equal(isCrossSiteBrowserRequest(request, env), false);
    assert.equal(isSameOriginBrowserRequest(request, env), true);
  });

  it("allows trusted split-hostname origins even when sec-fetch-site is cross-site", () => {
    const env = {
      PUBLIC_APP_URL: "https://uwe.example",
      NEXT_PUBLIC_PORTAL_URL: "https://portal.uwe.example",
      NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
    };
    const request = makeRequest({
      origin: "https://studio.uwe.example",
      host: "uwe.example",
      "sec-fetch-site": "cross-site",
    });

    assert.equal(isCrossSiteBrowserRequest(request, env), false);
    assert.equal(assessApiOrigin(request, env).blocked, false);
  });

  it("does not allow wildcard CORS origins by default", () => {
    const request = makeRequest({
      origin: "https://anyone.example",
      host: "studio.local",
    });
    assert.equal(isCrossSiteBrowserRequest(request), true);
  });
});
