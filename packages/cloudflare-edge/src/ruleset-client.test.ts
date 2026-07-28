import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MANAGED_CHALLENGE_RULE_REF, normalizeManagedChallengeConfig } from "./managed-challenge";
import {
  applyManagedChallenge,
  fetchManagedChallengeState,
  hasCloudflareCredentials,
} from "./ruleset-client";

const CREDENTIALS = { apiToken: "cf-token", zoneId: "zone-1" };

const ACTIVE_CONFIG = normalizeManagedChallengeConfig({
  enabled: true,
  hostnames: ["studio.uwe.example"],
  skipPaths: ["/api/health"],
  action: "managed_challenge",
});

const EXPECTED_EXPRESSION =
  '(http.host in {"studio.uwe.example"}) and not (starts_with(http.request.uri.path, "/api/health"))';

interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
  authorization: string | null;
}

/** Minimal Cloudflare stub: GET returns `rules`, PUT echoes what it was sent. */
function stubFetch(
  rules: unknown[],
  options: { getStatus?: number; putStatus?: number; putErrors?: { message: string }[] } = {},
): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url: String(url),
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: headers.Authorization ?? null,
    });

    if (method === "GET") {
      const status = options.getStatus ?? 200;
      return {
        ok: status < 400,
        status,
        json: async () => (status === 200 ? { success: true, result: { id: "rs-1", rules } } : { success: false }),
      } as Response;
    }

    const status = options.putStatus ?? 200;
    const sent = init?.body ? (JSON.parse(String(init.body)) as { rules: unknown[] }) : { rules: [] };
    return {
      ok: status < 400,
      status,
      json: async () =>
        status < 400
          ? { success: true, result: { id: "rs-1", rules: sent.rules } }
          : { success: false, errors: options.putErrors ?? [{ message: "denied" }] },
    } as Response;
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

describe("credential guard", () => {
  it("requires both a token and a zone", () => {
    assert.equal(hasCloudflareCredentials(CREDENTIALS), true);
    assert.equal(hasCloudflareCredentials({ apiToken: "x", zoneId: null }), false);
    assert.equal(hasCloudflareCredentials({ apiToken: "  ", zoneId: "zone-1" }), false);
  });

  it("reports the missing configuration instead of calling the API", async () => {
    const { fetchImpl, calls } = stubFetch([]);
    const result = await applyManagedChallenge(ACTIVE_CONFIG, { apiToken: null, zoneId: null }, { fetchImpl });

    assert.equal(result.ok, false);
    assert.equal(result.changed, false);
    assert.equal(calls.length, 0);
    assert.match(result.message, /Zugangsdaten/);
  });
});

describe("reading the edge state", () => {
  it("reports the UWE rule and counts foreign rules", async () => {
    const { fetchImpl } = stubFetch([
      { id: "other", action: "block", expression: "ip.src eq 1.2.3.4" },
      {
        id: "uwe-1",
        ref: MANAGED_CHALLENGE_RULE_REF,
        action: "managed_challenge",
        expression: EXPECTED_EXPRESSION,
        enabled: true,
      },
    ]);

    const state = await fetchManagedChallengeState(CREDENTIALS, { fetchImpl });
    assert.equal(state.ok, true);
    assert.equal(state.present, true);
    assert.equal(state.active, true);
    assert.equal(state.action, "managed_challenge");
    assert.equal(state.foreignRuleCount, 1);
    assert.equal(state.rulesetId, "rs-1");
  });

  it("treats a zone without custom rules (404) as 'not present', not an error", async () => {
    const { fetchImpl } = stubFetch([], { getStatus: 404 });
    const state = await fetchManagedChallengeState(CREDENTIALS, { fetchImpl });

    assert.equal(state.ok, true);
    assert.equal(state.present, false);
    assert.equal(state.foreignRuleCount, 0);
  });

  it("surfaces an API error without leaking the token", async () => {
    const { fetchImpl } = stubFetch([], { getStatus: 403 });
    const state = await fetchManagedChallengeState(CREDENTIALS, { fetchImpl });

    assert.equal(state.ok, false);
    assert.ok(!state.message.includes("cf-token"));
  });
});

describe("applying the challenge", () => {
  it("creates the rule, preserving foreign rules and sending a bearer token", async () => {
    const foreign = { id: "other", action: "block", expression: "ip.src eq 1.2.3.4", version: "3" };
    const { fetchImpl, calls } = stubFetch([foreign]);

    const result = await applyManagedChallenge(ACTIVE_CONFIG, CREDENTIALS, { fetchImpl });
    assert.equal(result.ok, true);
    assert.equal(result.changed, true);

    const put = calls.find((call) => call.method === "PUT");
    assert.ok(put, "expected a PUT to the entrypoint ruleset");
    assert.equal(put.authorization, "Bearer cf-token");
    assert.match(put.url, /\/zones\/zone-1\/rulesets\/phases\/http_request_firewall_custom\/entrypoint$/);

    const sent = (put.body as { rules: Record<string, unknown>[] }).rules;
    assert.equal(sent.length, 2);
    assert.equal(sent[0]?.id, "other");
    assert.equal(sent[0]?.version, undefined, "server-managed fields are stripped before write");
    assert.equal(sent[1]?.ref, MANAGED_CHALLENGE_RULE_REF);
    assert.equal(sent[1]?.action, "managed_challenge");
    assert.equal(sent[1]?.expression, EXPECTED_EXPRESSION);
  });

  it("is idempotent — no write when the edge already matches", async () => {
    const { fetchImpl, calls } = stubFetch([
      {
        id: "uwe-1",
        ref: MANAGED_CHALLENGE_RULE_REF,
        action: "managed_challenge",
        expression: EXPECTED_EXPRESSION,
        enabled: true,
      },
    ]);

    const result = await applyManagedChallenge(ACTIVE_CONFIG, CREDENTIALS, { fetchImpl });
    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
    assert.equal(calls.filter((call) => call.method === "PUT").length, 0);
  });

  it("rewrites the rule when the hostnames changed", async () => {
    const { fetchImpl, calls } = stubFetch([
      {
        id: "uwe-1",
        ref: MANAGED_CHALLENGE_RULE_REF,
        action: "managed_challenge",
        expression: '(http.host in {"old.uwe.example"})',
        enabled: true,
      },
    ]);

    const result = await applyManagedChallenge(ACTIVE_CONFIG, CREDENTIALS, { fetchImpl });
    assert.equal(result.changed, true);
    const put = calls.find((call) => call.method === "PUT");
    const sent = (put?.body as { rules: Record<string, unknown>[] }).rules;
    assert.equal(sent[0]?.id, "uwe-1", "the existing rule is updated, not duplicated");
    assert.equal(sent[0]?.expression, EXPECTED_EXPRESSION);
  });

  it("removes only the UWE rule when disabled", async () => {
    const { fetchImpl, calls } = stubFetch([
      { id: "other", action: "block", expression: "ip.src eq 1.2.3.4" },
      { id: "uwe-1", ref: MANAGED_CHALLENGE_RULE_REF, action: "managed_challenge", enabled: true },
    ]);

    const result = await applyManagedChallenge(
      normalizeManagedChallengeConfig({ enabled: false }),
      CREDENTIALS,
      { fetchImpl },
    );

    assert.equal(result.ok, true);
    assert.equal(result.changed, true);
    const sent = (calls.find((call) => call.method === "PUT")?.body as { rules: unknown[] }).rules;
    assert.equal(sent.length, 1);
    assert.equal((sent[0] as { id: string }).id, "other");
  });

  it("does not write when the rule is already absent", async () => {
    const { fetchImpl, calls } = stubFetch([{ id: "other", action: "block" }]);
    const result = await applyManagedChallenge(
      normalizeManagedChallengeConfig({ enabled: false }),
      CREDENTIALS,
      { fetchImpl },
    );

    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
    assert.equal(calls.filter((call) => call.method === "PUT").length, 0);
  });

  it("reports a write failure with the Cloudflare message", async () => {
    const { fetchImpl } = stubFetch([], {
      putStatus: 403,
      putErrors: [{ message: "Zone WAF Edit permission required" }],
    });

    const result = await applyManagedChallenge(ACTIVE_CONFIG, CREDENTIALS, { fetchImpl });
    assert.equal(result.ok, false);
    assert.equal(result.changed, false);
    assert.match(result.message, /permission required/);
    assert.ok(!result.message.includes("cf-token"));
  });

  it("fails closed on a network error", async () => {
    const fetchImpl = (async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;

    const result = await applyManagedChallenge(ACTIVE_CONFIG, CREDENTIALS, { fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.message, /Netzwerkfehler/);
  });
});
