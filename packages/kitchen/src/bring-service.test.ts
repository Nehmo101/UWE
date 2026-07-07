import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@uwe/database/server";
import { encryptSecret } from "@uwe/database/token-crypto";
import { BringService } from "./bring-service";

const SECRET = "test-secret";

/** Fake-`fetch`, das je nach Methode+URL antwortet und PUT-Bodies mitschreibt. */
function syncFetch(remotePurchase: { name: string; spec?: string }[]) {
  const putBodies: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/v2/bringauth")) {
      return jsonResponse({ access_token: "a", uuid: "u", publicUuid: "p" });
    }
    if (method === "GET" && /\/bringlists\/[^/]+$/.test(url)) {
      return jsonResponse({ purchase: remotePurchase, recently: [] });
    }
    if (method === "PUT" && /\/bringlists\/[^/]+$/.test(url)) {
      putBodies.push(String(init?.body ?? ""));
      return jsonResponse({});
    }
    throw new Error(`unerwarteter Request: ${method} ${url}`);
  }) as typeof fetch;

  return { fetch: impl, putBodies };
}

function jsonResponse(json: unknown): Response {
  return { ok: true, status: 200, json: async () => json } as Response;
}

/** Minimaler Fake-PrismaClient — nur die von syncShoppingList genutzten Pfade. */
function fakeDb(items: Array<Record<string, unknown>>) {
  const created: Array<Record<string, unknown>> = [];
  const db = {
    bringConnection: {
      findUnique: async () => ({
        id: "singleton",
        emailEncrypted: encryptSecret("a@b.de", SECRET),
        passwordEncrypted: encryptSecret("pw", SECRET),
        defaultListUuid: "list-1",
        defaultListName: "Zuhause",
      }),
      update: async () => ({}),
    },
    shoppingListItem: {
      findMany: async () => items,
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        created.push(...data);
        return { count: data.length };
      },
    },
  } as unknown as PrismaClient;
  return { db, created };
}

describe("BringService.syncShoppingList (Union-Merge)", () => {
  it("pulls remote-only items and pushes open UWE-only items, non-destructively", async () => {
    const items = [
      { name: "Tomaten", checked: false, amount: 500, unit: "gram", unitLabel: null },
      { name: "Eier", checked: false, amount: null, unit: "freeform", unitLabel: null },
      { name: "Milch", checked: true, amount: null, unit: "freeform", unitLabel: null },
    ];
    const { db, created } = fakeDb(items);
    const { fetch: fetchImpl, putBodies } = syncFetch([
      { name: "Tomaten", spec: "500 g" }, // schon in UWE → kein Pull
      { name: "Brot", spec: "2" }, // nur bei Bring! → Pull nach UWE
    ]);

    const service = new BringService(db, SECRET, { fetch: fetchImpl });
    const summary = await service.syncShoppingList("shopping-1");

    // Pull: nur „Brot" landet neu in UWE.
    assert.equal(summary.addedToUwe, 1);
    assert.equal(created.length, 1);
    assert.equal(created[0].name, "Brot");
    assert.equal(created[0].unitLabel, "2");

    // Push: „Eier" (offen, nicht bei Bring!) wird gesendet; „Tomaten" ist schon
    // dort, „Milch" ist abgehakt → beide nicht gepusht.
    assert.equal(summary.pushedToBring, 1);
    assert.equal(summary.pushFailed, 0);
    assert.equal(putBodies.length, 1);
    assert.match(putBodies[0], /purchase=Eier/);
    assert.equal(summary.listName, "Zuhause");
  });
});
