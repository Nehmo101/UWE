import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import { requireStudioApiAuth } from "@uwe/security";
import {
  assertStudioRouteProtected,
  listProtectedStudioApiRoutes,
  listStudioApiRouteFiles,
  STUDIO_AUTH_GUARD_PATTERN,
  STUDIO_DELEGATED_GUARD_ROUTES,
  STUDIO_PUBLIC_API_ALLOWLIST,
  STUDIO_PUBLIC_READ_API_ROUTES,
} from "./studio-route-inventory";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TWO_FACTOR_ROUTES_HELPER = path.join(repoRoot, "apps/studio/src/lib/two-factor-routes.ts");

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

const AUTH_GUARD = STUDIO_AUTH_GUARD_PATTERN;

/** Routes that mutate state or expose DM data — derived from full Studio API inventory. */
const STUDIO_PROTECTED_API_ROUTES = listProtectedStudioApiRoutes(repoRoot).map(
  (relative) => `apps/studio/app/api/${relative}`,
);

/** @deprecated use STUDIO_PUBLIC_API_ALLOWLIST — kept for explicit public route tests */
const STUDIO_PUBLIC_API_ROUTES = [
  ...[...STUDIO_PUBLIC_API_ALLOWLIST].map((route) => `apps/studio/app/api/${route}`),
  ...[...STUDIO_PUBLIC_READ_API_ROUTES].map((route) => `apps/studio/app/api/${route}`),
];

const STUDIO_UI_ROUTES = [
  "apps/studio/app/page.tsx",
  "apps/studio/app/studio/page.tsx",
  "apps/studio/app/forgot-password/page.tsx",
  "apps/studio/app/reset-password/page.tsx",
  "apps/studio/app/admin/ai-prompt/page.tsx",
  "apps/studio/app/admin/agent-jobs/page.tsx",
  "apps/studio/app/search/page.tsx",
  "apps/studio/app/worlds/page.tsx",
  "apps/studio/app/worlds/[worldSlug]/dashboard/page.tsx",
];

// The legacy /worlds/** redirect pages were removed; what is left of the Portal
// beyond the login pages sits behind the session gate.
const PORTAL_PUBLIC_ROUTES = [
  "apps/portal/app/api/worlds/[worldSlug]/graph/route.ts",
  "apps/portal/app/api/health/route.ts",
];

const PORTAL_AUTH_ROUTES = [
  "apps/portal/app/login/page.tsx",
  "apps/portal/app/forgot-password/page.tsx",
  "apps/portal/app/reset-password/page.tsx",
  "apps/portal/app/portal/page.tsx",
  "apps/portal/app/auth/worlds/(hub)/page.tsx",
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

  it("serves public landing at / and protected dashboard at /studio", () => {
    assert.ok(exists("apps/studio/app/page.tsx"));
    assert.ok(exists("apps/studio/app/studio/page.tsx"));
    const landing = read("apps/studio/app/page.tsx");
    // Ohne getrennte Hostnamen (unified-path / lokal) bleibt „/" die Landing;
    // bei getrennten Hostnamen leitet dieselbe Seite weiter, weil der Apex eine
    // eigene App hat (apps/landing).
    assert.match(landing, /UweLandingPage/);
    assert.match(landing, /split-hostname/);
  });
});

describe("route authorization — Startseiten-App (Apex-Origin)", () => {
  // Der Apex ist die einzige völlig ungeschützte Fläche von UWE. Er trägt
  // deshalb genau drei Routen — jede weitere hier wäre öffentlich erreichbar,
  // ohne dass ein Rollen-Gate davor liegt.
  const ALLOWED = ["/", "/api/auth/enter", "/api/health"];

  it("bringt nur Startseite, Anmeldung und Health mit", () => {
    const routes = listRouteFiles("apps/landing/app").map((file) => file.replaceAll("\\", "/"));
    assert.deepEqual(routes, [
      "apps/landing/app/api/auth/enter/route.ts",
      "apps/landing/app/api/health/route.ts",
    ]);
    assert.ok(exists("apps/landing/app/page.tsx"));
  });

  it("zeigt die Startseite auch dem angemeldeten Besucher", () => {
    // Der Apex leitete Angemeldete früher sofort ins Studio weiter. Damit war
    // die Startseite für jeden mit Sitzung unerreichbar — also gerade für den
    // Betreiber. Sie ist aber der Ort, von dem aus man zwischen Studio, Portal,
    // Brain und Family wechselt.
    const page = read("apps/landing/app/page.tsx");
    assert.doesNotMatch(page, /\bredirect\(/, "Der Apex leitet Angemeldete wieder weg");
    assert.match(page, /signedIn=\{Boolean\(user\)\}/);
  });

  it("riegelt alles außerhalb der Allowlist in der Middleware ab", () => {
    const middleware = read("apps/landing/middleware.ts");
    for (const route of ALLOWED) {
      assert.ok(
        middleware.includes(`"${route}"`),
        `Allowlist der Landing-Middleware nennt ${route} nicht`,
      );
    }
    // Unbekannte Seitenpfade gehen ins Studio, unbekannte API-Pfade auf 404.
    assert.match(middleware, /NextResponse\.redirect\(target, 308\)/);
    assert.match(middleware, /status: 404/);
  });
});

describe("route authorization — /admin and /api/admin/*", () => {
  const adminRoutes = [
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

describe("route authorization — /admin/command (NL command center)", () => {
  it("includes command center page and admin command API routes", () => {
    assert.ok(exists("apps/studio/app/command/page.tsx"));
    assert.ok(exists("apps/studio/app/api/admin/command/parse/route.ts"));
    assert.ok(exists("apps/studio/app/api/admin/command/execute/route.ts"));
    assert.ok(exists("apps/studio/app/api/admin/command/audit/route.ts"));
  });

  for (const route of [
    "apps/studio/app/api/admin/command/parse/route.ts",
    "apps/studio/app/api/admin/command/execute/route.ts",
    "apps/studio/app/api/admin/command/audit/route.ts",
  ]) {
    it(`${route} calls a studio auth guard`, () => {
      assert.match(read(route), AUTH_GUARD);
    });
  }

  it("blocks cross-site POST to /api/admin/command/execute", () => {
    const result = requireStudioApiAuth(makeCrossSiteRequest("/api/admin/command/execute"));
    assert.ok(result);
    assert.equal(result.status, 403);
  });
});

describe("route authorization — /api/search/* (command palette + search page)", () => {
  it("includes /search page and /api/command/search", () => {
    assert.ok(exists("apps/studio/app/search/page.tsx"));
    assert.ok(exists("apps/studio/app/api/command/search/route.ts"));
  });

  it("requires auth on command palette search", () => {
    const source = read("apps/studio/app/api/command/search/route.ts");
    assert.match(source, AUTH_GUARD);
    assert.match(source, /search\("dm"|searchStudioCrossDomain/);
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

  it("portal graph route uses viewer access context for graph filtering", () => {
    const source = read("apps/portal/app/api/worlds/[worldSlug]/graph/route.ts");
    assert.match(source, /buildWorldGraphForViewer\(repo, worldSlug, ctx/);
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
  const routes = listStudioApiRouteFiles(repoRoot);

  it("discovers the full Studio API surface", () => {
    assert.ok(routes.length >= 50, `expected many routes, got ${routes.length}`);
  });

  for (const relativeRoute of routes) {
    it(`${relativeRoute} is protected or explicitly allowlisted`, () => {
      assert.doesNotThrow(() =>
        assertStudioRouteProtected(repoRoot, relativeRoute, TWO_FACTOR_ROUTES_HELPER),
      );
    });
  }

  for (const route of STUDIO_PROTECTED_API_ROUTES.filter(
    (entry) => !STUDIO_DELEGATED_GUARD_ROUTES.has(entry.replace("apps/studio/app/api/", "")),
  )) {
    it(`${route} calls a studio auth guard`, () => {
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
