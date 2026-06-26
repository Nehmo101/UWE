import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONNECTOR_TOKEN_PREFIX,
  generateConnectorToken,
  hashConnectorToken,
  looksLikeConnectorToken,
  parseConnectorBearer,
  verifyConnectorToken,
} from "./token";

test("generated tokens are prefixed, unique and not stored in plaintext", () => {
  const a = generateConnectorToken();
  const b = generateConnectorToken();
  assert.ok(a.startsWith(CONNECTOR_TOKEN_PREFIX));
  assert.notEqual(a, b);

  const hash = hashConnectorToken(a);
  assert.notEqual(hash, a, "hash must not equal the raw token");
  assert.match(hash, /^[0-9a-f]{64}$/, "sha-256 hex digest");
});

test("verifyConnectorToken accepts the right token and rejects others", () => {
  const token = generateConnectorToken();
  const hash = hashConnectorToken(token);
  assert.equal(verifyConnectorToken(token, hash), true);
  assert.equal(verifyConnectorToken(`${token}x`, hash), false);
  assert.equal(verifyConnectorToken(generateConnectorToken(), hash), false);
  assert.equal(verifyConnectorToken("", hash), false);
  assert.equal(verifyConnectorToken(token, ""), false);
});

test("hashing is stable and trims whitespace", () => {
  const token = generateConnectorToken();
  assert.equal(hashConnectorToken(token), hashConnectorToken(`  ${token}  `));
});

test("looksLikeConnectorToken and parseConnectorBearer", () => {
  const token = generateConnectorToken();
  assert.equal(looksLikeConnectorToken(token), true);
  assert.equal(looksLikeConnectorToken("nope"), false);
  assert.equal(looksLikeConnectorToken(null), false);

  assert.equal(parseConnectorBearer(`Bearer ${token}`), token);
  assert.equal(parseConnectorBearer(`bearer ${token}`), token);
  assert.equal(parseConnectorBearer(token), null);
  assert.equal(parseConnectorBearer(null), null);
});
