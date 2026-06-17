import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCrossSiteBrowserRequest } from "@uwe/auth";
import { requirePortalApiAuth } from "./portal-api-auth";

function makePortalApiRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://portal.local/api/auth/login", {
    method: "POST",
    headers,
  });
}

describe("portal API CORS policy", () => {
  it("blocks foreign browser origins on protected APIs", () => {
    const request = makePortalApiRequest({
      origin: "https://evil.example",
      host: "portal.local",
    });

    assert.equal(isCrossSiteBrowserRequest(request), true);
  });

  it("allows same-origin portal API requests", () => {
    const request = makePortalApiRequest({
      origin: "http://portal.local",
      host: "portal.local",
      "sec-fetch-site": "same-origin",
    });

    assert.equal(isCrossSiteBrowserRequest(request), false);
  });

  it("blocks cross-site mutating auth routes in the API guard", async () => {
    const request = makePortalApiRequest({
      origin: "https://evil.example",
      host: "portal.local",
    });

    const response = await requirePortalApiAuth(request);

    assert.equal(response?.status, 403);
    assert.deepEqual(await response?.json(), {
      error: "Cross-Origin-Anfragen an die Portal-API sind nicht erlaubt.",
    });
  });
});
