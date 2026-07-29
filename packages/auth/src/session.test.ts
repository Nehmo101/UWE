import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSessionTokensFromCookieHeader, SESSION_COOKIE_NAME } from "./session";
import { getSessionCookieClearVariants } from "./runtime-config";

describe("readSessionTokensFromCookieHeader", () => {
  it("reads a single session cookie", () => {
    assert.deepEqual(readSessionTokensFromCookieHeader(`${SESSION_COOKIE_NAME}=aaaa`), ["aaaa"]);
  });

  it("returns duplicates LAST-first so the newest cookie wins like cookies() does", () => {
    // A host-only and a domain-scoped cookie of the same name are two distinct cookies;
    // the browser sends both, oldest (= stale) first. Reading only the first one made
    // every API guard 401 while the page authenticated fine.
    assert.deepEqual(
      readSessionTokensFromCookieHeader(
        `${SESSION_COOKIE_NAME}=stale; theme=dark; ${SESSION_COOKIE_NAME}=valid`,
      ),
      ["valid", "stale"],
    );
  });

  it("drops empty and whitespace-only values", () => {
    assert.deepEqual(
      readSessionTokensFromCookieHeader(`${SESSION_COOKIE_NAME}=; ${SESSION_COOKIE_NAME}=valid`),
      ["valid"],
    );
    assert.deepEqual(readSessionTokensFromCookieHeader(`${SESSION_COOKIE_NAME}=`), []);
  });

  it("does not match cookies that merely share the name prefix", () => {
    assert.deepEqual(
      readSessionTokensFromCookieHeader(`${SESSION_COOKIE_NAME}_preview=aaaa; other=bbbb`),
      [],
    );
  });

  it("handles a missing header", () => {
    assert.deepEqual(readSessionTokensFromCookieHeader(null), []);
    assert.deepEqual(readSessionTokensFromCookieHeader(undefined), []);
    assert.deepEqual(readSessionTokensFromCookieHeader(""), []);
  });

  it("percent-decodes without throwing on malformed escapes", () => {
    assert.deepEqual(readSessionTokensFromCookieHeader(`${SESSION_COOKIE_NAME}=a%2Bb`), ["a+b"]);
    assert.deepEqual(readSessionTokensFromCookieHeader(`${SESSION_COOKIE_NAME}=a%zz`), ["a%zz"]);
  });
});

describe("getSessionCookieClearVariants", () => {
  const request = { url: "https://uweanddragons.org/api/auth/logout", headers: new Headers() };

  it("clears only the host-only cookie when no domain is configured", () => {
    const variants = getSessionCookieClearVariants(request, {
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "false",
    } as NodeJS.ProcessEnv);

    assert.equal(variants.length, 1);
    assert.equal(variants[0]?.domain, undefined);
  });

  it("clears both scopes when SESSION_COOKIE_DOMAIN is configured", () => {
    // Clearing only the configured variant leaves the other cookie behind forever,
    // where it shadows the fresh session on every request.
    const variants = getSessionCookieClearVariants(request, {
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "false",
      SESSION_COOKIE_DOMAIN: ".uweanddragons.org",
    } as NodeJS.ProcessEnv);

    assert.equal(variants.length, 2);
    assert.equal(variants[0]?.domain, ".uweanddragons.org");
    assert.equal(variants[1]?.domain, undefined);
    assert.equal(variants[1]?.path, "/");
  });
});
