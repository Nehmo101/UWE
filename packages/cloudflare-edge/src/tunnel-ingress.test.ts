import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTunnelIngressPlan,
  decodeTunnelToken,
  ingressMatchesPlan,
  mergeTunnelIngress,
  planToIngressRules,
} from "./tunnel-ingress";
import { applyTunnelIngress, fetchTunnelIngressState } from "./tunnel-client";

const SPLIT_HOSTNAME_ENV = {
  PUBLIC_BASE_URL: "https://uwe.example",
  NEXT_PUBLIC_STUDIO_URL: "https://studio.uwe.example",
  NEXT_PUBLIC_PORTAL_URL: "https://portal.uwe.example",
} satisfies NodeJS.ProcessEnv;

const IDENTITY = { accountId: "acct", tunnelId: "tun" };

/** Minimaler Cloudflare-Doppelgänger: liefert je URL/Methode eine feste Antwort. */
function fakeFetch(routes: Record<string, unknown>, calls: { method: string; url: string; body: unknown }[]) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const method = init?.method ?? "GET";
    calls.push({ method, url: href, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(routes).find((entry) => href.includes(entry.split(" ")[1]) && entry.startsWith(method));
    const payload = key ? routes[key] : { success: true, result: null };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("tunnel ingress plan", () => {
  it("routes every app, family included, and leaves brain out by default", () => {
    const plan = buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV);

    assert.equal(plan.ok, true);
    assert.equal(plan.apexHost, "uwe.example");
    const hostnames = plan.routes.map((route) => route.hostname);
    assert.ok(hostnames.includes("family.uwe.example"), "Family fehlt im Ingress");
    assert.ok(!hostnames.includes("brain.uwe.example"), "Brain darf nicht ohne Opt-in im Tunnel stehen");
    // Der Family-Port ist der, auf dem die App tatsächlich bindet.
    assert.equal(plan.routes.find((route) => route.label === "Family")?.port, 3004);
    assert.deepEqual(plan.dnsHosts, [
      "studio.uwe.example",
      "portal.uwe.example",
      "family.uwe.example",
      "uwe.example",
    ]);
  });

  it("takes brain in only with the explicit opt-in", () => {
    const plan = buildTunnelIngressPlan({ ...SPLIT_HOSTNAME_ENV, BRAIN_PUBLIC_TUNNEL: "1" });
    assert.ok(plan.routes.some((route) => route.hostname === "brain.uwe.example"));
  });

  it("refuses to plan without a public domain", () => {
    const plan = buildTunnelIngressPlan({ NEXT_PUBLIC_STUDIO_URL: "http://localhost:3000" });
    assert.equal(plan.ok, false);
    assert.equal(plan.routes.length, 0);
    assert.match(plan.notes[0] ?? "", /öffentliche Domain/);
  });

  it("honours configured ports and a custom family hostname", () => {
    const plan = buildTunnelIngressPlan({
      ...SPLIT_HOSTNAME_ENV,
      NEXT_PUBLIC_FAMILY_URL: "https://haushalt.uwe.example",
      FAMILY_PORT: "3999",
    });
    const family = plan.routes.find((route) => route.label === "Family");
    assert.equal(family?.hostname, "haushalt.uwe.example");
    assert.equal(family?.port, 3999);
  });
});

describe("tunnel ingress merge", () => {
  const desired = planToIngressRules(buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV));

  it("keeps foreign routes and always ends on the catch-all", () => {
    const foreign = { hostname: "shop.uwe.example", service: "http://127.0.0.1:8080" };
    const merged = mergeTunnelIngress([foreign, { service: "http_status:404" }], desired);

    assert.deepEqual(merged.preserved, [foreign]);
    assert.deepEqual(merged.rules[0], foreign, "fremde Regeln stehen vorn (spezifischere Pfade zuerst)");
    assert.deepEqual(merged.rules.at(-1), { service: "http_status:404" });
    assert.equal(merged.rules.filter((rule) => rule.service === "http_status:404").length, 1);
  });

  it("replaces a stale route for a hostname UWE owns", () => {
    const stale = { hostname: "family.uwe.example", service: "http://127.0.0.1:9999" };
    const merged = mergeTunnelIngress([stale], desired);

    assert.deepEqual(merged.preserved, [], "die eigene Route wird ersetzt, nicht doppelt geführt");
    assert.ok(
      merged.rules.some(
        (rule) => rule.hostname === "family.uwe.example" && rule.service === "http://127.0.0.1:3004",
      ),
    );
  });

  it("keeps a foreign path rule on the apex", () => {
    const webhook = { hostname: "uwe.example", path: "/webhook", service: "http://127.0.0.1:9000" };
    const merged = mergeTunnelIngress([webhook], desired);
    assert.deepEqual(merged.preserved, [webhook]);
    assert.ok(merged.rules.indexOf(webhook) < merged.rules.findIndex((rule) => rule.hostname === "uwe.example" && !rule.path));
  });

  it("detects an already matching ingress", () => {
    assert.equal(ingressMatchesPlan(desired, desired), true);
    assert.equal(ingressMatchesPlan(desired.slice(1), desired), false);
  });
});

describe("tunnel token", () => {
  it("decodes account and tunnel id, and rejects junk", () => {
    const token = Buffer.from(JSON.stringify({ a: "acct-1", t: "tun-1", s: "secret" })).toString("base64");
    assert.deepEqual(decodeTunnelToken(token), { accountId: "acct-1", tunnelId: "tun-1" });
    assert.equal(decodeTunnelToken("nonsense"), null);
    assert.equal(decodeTunnelToken(""), null);
    assert.equal(decodeTunnelToken(null), null);
  });
});

describe("tunnel apply", () => {
  it("writes the ingress and ensures the DNS records", async () => {
    const calls: { method: string; url: string; body: unknown }[] = [];
    const plan = buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV);
    const result = await applyTunnelIngress("token", IDENTITY, plan, null, {
      fetchImpl: fakeFetch(
        {
          "GET /cfd_tunnel": { success: true, result: { config: { ingress: [] } } },
          "PUT /cfd_tunnel": { success: true, result: {} },
          "GET /zones?": { success: true, result: [{ id: "zone-1" }] },
          "GET /dns_records": { success: true, result: [] },
          "POST /dns_records": { success: true, result: { id: "rec" } },
        },
        calls,
      ),
    });

    assert.equal(result.ok, true);
    assert.equal(result.changed, true);
    // Jeder Hostname bekommt einen proxied CNAME auf den Tunnel.
    assert.deepEqual(
      result.dns.map((record) => record.outcome),
      ["created", "created", "created", "created"],
    );
    const put = calls.find((call) => call.method === "PUT" && call.url.includes("cfd_tunnel"));
    const ingress = (put?.body as { config: { ingress: { hostname?: string }[] } }).config.ingress;
    assert.ok(ingress.some((rule) => rule.hostname === "family.uwe.example"));
    const created = calls.filter((call) => call.method === "POST");
    assert.ok(created.every((call) => (call.body as { proxied: boolean }).proxied === true));
  });

  it("never overwrites a foreign DNS record", async () => {
    const calls: { method: string; url: string; body: unknown }[] = [];
    const plan = buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV);
    const result = await applyTunnelIngress("token", IDENTITY, plan, "zone-1", {
      fetchImpl: fakeFetch(
        {
          "GET /cfd_tunnel": { success: true, result: { config: { ingress: planToIngressRules(plan) } } },
          // Der Apex trägt bereits eine fremde Seite — die darf UWE nicht umbiegen.
          "GET /dns_records": {
            success: true,
            result: [{ id: "rec", type: "A", content: "203.0.113.10", proxied: true }],
          },
        },
        calls,
      ),
    });

    assert.equal(result.ok, false, "ein Konflikt darf nicht als Erfolg gemeldet werden");
    assert.ok(result.dns.every((record) => record.outcome === "conflict"));
    assert.match(result.message, /Fremde DNS-Einträge unangetastet/);
    assert.equal(
      calls.filter((call) => call.method === "POST" || call.method === "PUT").length,
      0,
      "kein Schreibzugriff bei fremdem Eintrag",
    );
  });

  it("retargets a record that already points at another tunnel", async () => {
    const calls: { method: string; url: string; body: unknown }[] = [];
    const plan = buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV);
    const result = await applyTunnelIngress("token", IDENTITY, plan, "zone-1", {
      fetchImpl: fakeFetch(
        {
          "GET /cfd_tunnel": { success: true, result: { config: { ingress: planToIngressRules(plan) } } },
          "GET /dns_records": {
            success: true,
            result: [{ id: "rec", type: "CNAME", content: "alt.cfargotunnel.com", proxied: true }],
          },
          "PUT /dns_records": { success: true, result: { id: "rec" } },
        },
        calls,
      ),
    });

    assert.equal(result.ok, true);
    assert.ok(result.dns.every((record) => record.outcome === "updated"));
  });

  it("reports a missing tunnel permission instead of pretending success", async () => {
    const failing = (async () =>
      new Response(JSON.stringify({ success: false, errors: [{ message: "Authentication error" }] }), {
        status: 403,
      })) as unknown as typeof fetch;

    const state = await fetchTunnelIngressState("token", IDENTITY, buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV), {
      fetchImpl: failing,
    });
    assert.equal(state.ok, false);
    assert.match(state.message, /Authentication error/);

    const result = await applyTunnelIngress("token", IDENTITY, buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV), null, {
      fetchImpl: failing,
    });
    assert.equal(result.ok, false);
    assert.equal(result.changed, false);
  });

  it("does not rewrite an ingress that already matches", async () => {
    const calls: { method: string; url: string; body: unknown }[] = [];
    const plan = buildTunnelIngressPlan(SPLIT_HOSTNAME_ENV);
    const result = await applyTunnelIngress("token", IDENTITY, plan, "zone-1", {
      fetchImpl: fakeFetch(
        {
          "GET /cfd_tunnel": { success: true, result: { config: { ingress: planToIngressRules(plan) } } },
          "GET /dns_records": {
            success: true,
            result: [{ id: "rec", type: "CNAME", content: "tun.cfargotunnel.com", proxied: true }],
          },
        },
        calls,
      ),
    });

    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
    assert.equal(calls.filter((call) => call.method === "PUT").length, 0);
    assert.match(result.message, /bereits korrekt/);
  });
});
