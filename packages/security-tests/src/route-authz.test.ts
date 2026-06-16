import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import { requireStudioApiAuth } from "../../../apps/studio/src/lib/studio-api-auth";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function listRouteFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const results: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "route.ts") {
        results.push(path.relative(repoRoot, full));
      }
    }
  };

  if (fs.existsSync(absoluteDir)) {
    walk(absoluteDir);
  }

  return results.sort();
}

function makeCrossSiteRequest(apiPath: string): Request {
  return new Request(`http://studio.local${apiPath}`, {
    method: "POST",
    headers: {
      host: "studio.local",
      "sec-fetch-site": "cross-site",
      origin: "http://evil.example",
    },
  });
}

function makeAnonymousGet(apiPath: string): Request {
  return new Request(`http://studio.local${apiPath}`, {
    method: "GET",
    headers: { host: "studio.local" },
  });
}

const AUTH_GUARD = /requireStudioApiAuth|guardStudioMutation/;

/** Routes that mutate state or expose DM data — must call a studio auth guard. */
const STUDIO_PROTECTED_API_ROUTES = [
  ...listRouteFiles("apps/studio/app/api/admin"),
  ...listRouteFiles("apps/studio/app/api/import").filter(
    (route) => !route.endsWith("import/formats/route.ts"),
  ),
  ...listRouteFiles("apps/studio/app/api/brain"),
  "apps/studio/app/api/ai/context/route.ts",
  "apps/studio/app/api/ai/generate/route.ts",
  "apps/studio/app/api/ai/prompt/route.ts",
  "apps/studio/app/api/ai/runs/route.ts",
  "apps/studio/app/api/ai/save/route.ts",
  "apps/studio/app/api/ai/proposals/discard/route.ts",
  "apps/studio/app/api/ai/proposals/[id]/route.ts",
  "apps/studio/app/api/ai/runs/[runId]/route.ts",
  "apps/studio/app/api/ai/settings/route.ts",
  "apps/studio/app/api/ai/sessions/route.ts",
  "apps/studio/app/api/ai/models/route.ts",
  "apps/studio/app/api/backup/route.ts",
  "apps/studio/app/api/settings/route.ts",
  "apps/studio/app/api/export/static/route.ts",
  "apps/studio/app/api/agent-jobs/route.ts",
  "apps/studio/app/api/dnd-api/route.ts",
  "apps/studio/app/api/dnd-generator/route.ts",
  "apps/studio/app/api/image-studio/route.ts",
  "apps/studio/app/api/inference/health/route.ts",
  "apps/studio/app/api/inference/test-prompt/route.ts",
  "apps/studio/app/api/worlds/[worldSlug]/brain/route.ts",
  "apps/studio/app/api/worlds/[worldSlug]/brain/[entryId]/route.ts",
  "apps/studio/app/api/worlds/[worldSlug]/assets/upload/route.ts",
];

/** Intentionally public read-only Studio endpoints (health, generator UI helpers). */
const STUDIO_PUBLIC_API_ROUTES = [
  "apps/studio/app/api/health/route.ts",
  "apps/studio/app/api/import/formats/route.ts",
];

const STUDIO_UI_ROUTES = [
  "apps/studio/app/page.tsx",
  "apps/studio/app/admin/status/page.tsx",
  "apps/studio/app/admin/ai-prompt/page.tsx",
  "apps/studio/app/admin/agent-jobs/page.tsx",
  "apps/studio/app/search/page.tsx",
  "apps/studio/app/worlds/page.tsx",
  "apps/studio/app/worlds/[worldSlug]/dashboard/page.tsx",
];

const PORTAL_PUBLIC_ROUTES = [
  "apps/portal/app/worlds/page.tsx",
  "apps/portal/app/worlds/[worldSlug]/page.tsx",
  "apps/portal/app/worlds/[worldSlug]/[category]/[slug]/page.tsx",
  "apps/portal/app/worlds/[worldSlug]/graph/page.tsx",
  "apps/portal/app/api/worlds/[worldSlug]/graph/route.ts",
  "apps/portal/app/api/health/route.ts",
];

const PORTAL_AUTH_ROUTES = [
  "apps/portal/app/login/page.tsx",
  "apps/portal/app/auth/worlds/page.tsx",
  "apps/portal/app/auth/worlds/[worldSlug]/page.tsx",
  "apps/portal/app/api/auth/login/route.ts",
  "apps/portal/app/api/auth/logout/route.ts",
];

describe("route authorization — Studio UI (/studio root)", () => {
  for (const route of STUDIO_UI_ROUTES) {
    it(`includes Studio route ${route}`, () => {
      assert.ok(exists(route), `Missing Studio route: ${route}`);
    });
  }

  it("documents that Studio has no /studio path prefix (app root)", () => {
    assert.ok(exists("apps/studio/app/page.tsx"));
    assert.ok(!exists("apps/studio/app/studio/page.tsx"));
  });
});

describe("route authorization — /admin and /api/admin/*", () => {
  const adminRoutes = [
    "apps/studio/app/admin/status/page.tsx",
    "apps/studio/app/admin/ai-prompt/page.tsx",
    "apps/studio/app/admin/agent-jobs/page.tsx",
    "apps/studio/app/api/admin/status/route.ts",
  ];

  for (const route of adminRoutes) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route));
    });
  }

  it("protects /api/admin/status against cross-site browser requests", () => {
    const result = requireStudioApiAuth(makeCrossSiteRequest("/api/admin/status"));
    assert.ok(result);
    assert.equal(result.status, 403);
  });
});

describe("route authorization — /api/import/*", () => {
  for (const route of listRouteFiles("apps/studio/app/api/import")) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route));
    });
  }

  it("protects import preview and execute from CSRF", () => {
    for (const apiPath of ["/api/import/preview", "/api/import/execute"]) {
      const result = requireStudioApiAuth(makeCrossSiteRequest(apiPath));
      assert.ok(result, `${apiPath} must reject cross-site requests`);
      assert.equal(result.status, 403);
    }
  });

  it("allows anonymous GET on import formats (read-only metadata)", () => {
    const result = requireStudioApiAuth(makeAnonymousGet("/api/import/formats"));
    assert.equal(result, null);
  });
});

describe("route authorization — /api/brain/*", () => {
  for (const route of [
    ...listRouteFiles("apps/studio/app/api/brain"),
    ...listRouteFiles("apps/studio/app/api/worlds/[worldSlug]/brain"),
  ]) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route));
    });

    it(`${route} calls a studio auth guard`, () => {
      const source = read(route);
      assert.match(source, AUTH_GUARD);
    });
  }

  it("blocks cross-site POST to /api/brain/run", () => {
    const result = requireStudioApiAuth(makeCrossSiteRequest("/api/brain/run"));
    assert.ok(result);
    assert.equal(result.status, 403);
  });
});

describe("route authorization — /api/ai/*", () => {
  for (const route of listRouteFiles("apps/studio/app/api/ai")) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route));
    });
  }

  for (const route of STUDIO_PROTECTED_API_ROUTES.filter((item) => item.includes("/api/ai/"))) {
    it(`${route} calls a studio auth guard`, () => {
      assert.match(read(route), AUTH_GUARD);
    });
  }

  for (const route of STUDIO_PUBLIC_API_ROUTES.filter((item) => item.includes("/api/ai/"))) {
    it(`${route} is intentionally public (no studio auth guard)`, () => {
      const source = read(route);
      assert.doesNotMatch(source, AUTH_GUARD);
    });
  }
});

describe("route authorization — /api/search/* (command palette + search page)", () => {
  it("includes /search page and /api/command/search", () => {
    assert.ok(exists("apps/studio/app/search/page.tsx"));
    assert.ok(exists("apps/studio/app/api/command/search/route.ts"));
  });

  it("requires auth on command palette search", () => {
    const source = read("apps/studio/app/api/command/search/route.ts");
    assert.match(source, AUTH_GUARD);
    assert.match(source, /search\("dm"/);
  });
});

describe("route authorization — /worlds/* (Portal)", () => {
  for (const route of PORTAL_PUBLIC_ROUTES) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route));
    });
  }

  for (const route of PORTAL_AUTH_ROUTES) {
    it(`includes authenticated portal route ${route}`, () => {
      assert.ok(exists(route));
    });
  }

  it("portal graph route uses portal visibility context", () => {
    const source = read("apps/portal/app/api/worlds/[worldSlug]/graph/route.ts");
    assert.match(source, /buildWorldGraph\(repo, worldSlug, "portal"\)/);
  });

  it("portal middleware guards portal routes in production", () => {
    const source = read("apps/portal/middleware.ts");
    assert.match(source, /evaluatePortalMiddleware|SESSION_COOKIE_NAME/);
  });
});

describe("route authorization — player management (/players/* → auth + mail)", () => {
  it("does not expose a /players/* route (by design)", () => {
    assert.ok(!exists("apps/portal/app/players"));
    assert.ok(!exists("apps/studio/app/players"));
  });

  it("manages players via world membership and mail recipients API", () => {
    const mailRoute = read("apps/studio/app/api/mail/recipients/route.ts");
    assert.match(mailRoute, AUTH_GUARD);
    assert.match(mailRoute, /sync_players/);
  });
});

describe("route authorization — protected Studio API inventory", () => {
  for (const route of STUDIO_PROTECTED_API_ROUTES) {
    it(`${route} exists and calls a studio auth guard`, () => {
      assert.ok(exists(route), `Missing protected route: ${route}`);
      assert.match(read(route), AUTH_GUARD);
    });
  }

  for (const route of STUDIO_PUBLIC_API_ROUTES) {
    it(`${route} exists`, () => {
      assert.ok(exists(route), `Missing public route: ${route}`);
    });
  }
});

describe("route authorization — STUDIO_API_TOKEN enforcement", () => {
  afterEach(() => {
    delete process.env.STUDIO_API_TOKEN;
  });

  it("requires bearer token for script clients when STUDIO_API_TOKEN is set", () => {
    process.env.STUDIO_API_TOKEN = "test-token";

    const blocked = requireStudioApiAuth(makeAnonymousGet("/api/brain/actions"));
    assert.ok(blocked);
    assert.equal(blocked.status, 401);

    const allowed = requireStudioApiAuth(
      new Request("http://studio.local/api/brain/actions", {
        headers: {
          host: "studio.local",
          authorization: "Bearer test-token",
        },
      }),
    );
    assert.equal(allowed, null);
  });
});
