import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BringApiError,
  bringGetListItems,
  bringLoadLists,
  bringLogin,
  bringPushItems,
  maskBringEmail,
  type BringAuth,
} from "./bring-client";

/** Baut einen minimalen Fake-`fetch`, der auf Method+URL antwortet. */
function fakeFetch(
  handler: (url: string, init: RequestInit | undefined) => {
    ok?: boolean;
    status?: number;
    json?: unknown;
  },
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const result = handler(url, init);
    return {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      json: async () => result.json ?? {},
    } as Response;
  }) as typeof fetch;
}

const AUTH: BringAuth = {
  accessToken: "tok",
  refreshToken: "ref",
  userUuid: "user-1",
  publicUuid: "pub-1",
};

describe("maskBringEmail", () => {
  it("masks the local part but keeps the domain", () => {
    assert.equal(maskBringEmail("alice@example.com"), "a****@example.com");
  });

  it("returns *** for malformed input", () => {
    assert.equal(maskBringEmail("no-at-sign"), "***");
  });
});

describe("bringLogin", () => {
  it("posts form-encoded credentials and maps the response", async () => {
    let seenUrl = "";
    let seenBody = "";
    const fetchImpl = fakeFetch((url, init) => {
      seenUrl = url;
      seenBody = String(init?.body ?? "");
      return {
        json: {
          access_token: "a",
          refresh_token: "r",
          uuid: "u",
          publicUuid: "p",
          name: "Küche",
        },
      };
    });

    const auth = await bringLogin("a@b.de", "secret", { fetch: fetchImpl });

    assert.match(seenUrl, /\/rest\/v2\/bringauth$/);
    assert.match(seenBody, /email=a%40b.de/);
    assert.match(seenBody, /password=secret/);
    assert.equal(auth.accessToken, "a");
    assert.equal(auth.userUuid, "u");
    assert.equal(auth.name, "Küche");
  });

  it("throws a 401 BringApiError on bad credentials", async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 401 }));
    await assert.rejects(
      () => bringLogin("a@b.de", "wrong", { fetch: fetchImpl }),
      (error: unknown) =>
        error instanceof BringApiError && error.status === 401,
    );
  });
});

describe("bringLoadLists", () => {
  it("extracts listUuid + name and drops entries without a uuid", async () => {
    const fetchImpl = fakeFetch(() => ({
      json: {
        lists: [
          { listUuid: "l1", name: "Zuhause", theme: "green" },
          { name: "kaputt" },
        ],
      },
    }));

    const lists = await bringLoadLists(AUTH, { fetch: fetchImpl });
    assert.equal(lists.length, 1);
    assert.deepEqual(lists[0], { listUuid: "l1", name: "Zuhause", theme: "green" });
  });
});

describe("bringGetListItems", () => {
  it("parses the flat v1 shape (name/specification)", async () => {
    const fetchImpl = fakeFetch(() => ({
      json: {
        purchase: [
          { name: "Tomaten", specification: "500 g" },
          { name: "Salz" },
          { specification: "ohne Name" },
        ],
        recently: [{ name: "Milch", specification: "1 l" }],
      },
    }));

    const contents = await bringGetListItems(AUTH, "l1", { fetch: fetchImpl });
    assert.deepEqual(contents.purchase, [
      { name: "Tomaten", spec: "500 g" },
      { name: "Salz", spec: "" },
    ]);
    assert.deepEqual(contents.recently, [{ name: "Milch", spec: "1 l" }]);
  });

  it("parses the nested v2 shape (items.purchase, itemId/spec)", async () => {
    const fetchImpl = fakeFetch(() => ({
      json: {
        items: {
          purchase: [{ itemId: "Brot", spec: "2" }],
          recently: [],
        },
      },
    }));

    const contents = await bringGetListItems(AUTH, "l1", { fetch: fetchImpl });
    assert.deepEqual(contents.purchase, [{ name: "Brot", spec: "2" }]);
    assert.deepEqual(contents.recently, []);
  });
});

describe("bringPushItems", () => {
  it("pushes each item and counts partial failures", async () => {
    const calls: string[] = [];
    const fetchImpl = fakeFetch((url, init) => {
      const body = String(init?.body ?? "");
      calls.push(body);
      // Simuliert einen Fehlschlag für „Milch".
      return body.includes("purchase=Milch") ? { ok: false, status: 500 } : {};
    });

    const result = await bringPushItems(
      AUTH,
      "list-9",
      [
        { name: "Tomaten", spec: "500 g" },
        { name: "Milch", spec: "1 l" },
        { name: "Salz" },
      ],
      { fetch: fetchImpl },
    );

    assert.equal(result.pushed, 2);
    assert.equal(result.failed, 1);
    assert.equal(calls.length, 3);
    assert.ok(calls.some((body) => /purchase=Tomaten/.test(body) && /specification=500\+g/.test(body)));
  });
});
