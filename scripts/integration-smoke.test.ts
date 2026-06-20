/**
 * Subagent 8 — Integration & release smoke checks.
 * Validates route scaffolding, security patterns, DnD-KI tasks, and documentation.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readPackageScripts(): Record<string, string> {
  const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  return pkg.scripts ?? {};
}

function assertScriptIncludesInOrder(scriptName: string, commands: string[]): void {
  const script = readPackageScripts()[scriptName];
  assert.ok(script, `Missing package.json script: ${scriptName}`);

  let previousIndex = -1;
  for (const command of commands) {
    const index = script.indexOf(command);
    assert.ok(index >= 0, `${scriptName} must include ${command}`);
    assert.ok(index > previousIndex, `${command} must run after the previous ${scriptName} command`);
    previousIndex = index;
  }
}

function listFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (pattern.test(entry.name)) {
        results.push(full);
      }
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return results;
}

/** Client-side files that must never reference server secrets. */
const FORBIDDEN_CLIENT_SECRET_PATTERNS = [
  /process\.env\.SESSION_SECRET/,
  /process\.env\.AUTH_SECRET/,
  /process\.env\.UWE_SETUP_TOKEN/,
  /process\.env\.RTX_SERVICE_TOKEN/,
  /process\.env\.RTX_AGENT_TOKEN/,
  /process\.env\.CLOUD_AI_API_KEY/,
  /process\.env\.STUDIO_API_TOKEN/,
  /process\.env\.SMTP_PASSWORD/,
  /process\.env\.OPENAI_API_KEY/,
  /process\.env\.CURSOR_CLOUD_API_KEY/,
  /process\.env\.CALDAV_PASSWORD/,
  /process\.env\.AGENT_JOBS_GITHUB_TOKEN/,
];

describe("integration smoke — core Studio routes", () => {
  const coreRoutes = [
    "apps/studio/app/page.tsx",
    "apps/studio/app/studio/page.tsx",
    "apps/studio/app/worlds/page.tsx",
    "apps/studio/app/brain/page.tsx",
    "apps/studio/app/mail/page.tsx",
    "apps/studio/app/backup/page.tsx",
    "apps/studio/app/jobs/page.tsx",
    "apps/studio/app/settings/page.tsx",
    "apps/studio/app/admin/status/page.tsx",
    "apps/studio/app/admin/cookbook/page.tsx",
    "apps/studio/app/admin/ai-prompt/page.tsx",
    "apps/studio/app/worlds/[worldSlug]/dashboard/page.tsx",
    "apps/studio/app/worlds/[worldSlug]/brain/page.tsx",
    "apps/studio/app/worlds/[worldSlug]/dungeons/page.tsx",
    "apps/studio/app/worlds/[worldSlug]/soundboard/page.tsx",
    "apps/studio/app/worlds/[worldSlug]/inspector/page.tsx",
    "apps/studio/app/worlds/[worldSlug]/labels/page.tsx",
  ];

  for (const route of coreRoutes) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route), `Missing core route: ${route}`);
    });
  }
});

describe("integration smoke — Daily Admin OS routes", () => {
  const plannedRoutes = [
    "apps/studio/app/today/page.tsx",
    "apps/studio/app/capture/page.tsx",
    "apps/studio/app/projects/page.tsx",
    "apps/studio/app/workshop/page.tsx",
    "apps/studio/app/contracts/page.tsx",
    "apps/studio/app/hardware/page.tsx",
    "apps/studio/app/life-brain/page.tsx",
    "apps/studio/app/life-brain/documents/[id]/page.tsx",
    "apps/studio/app/life-brain/facts/[id]/page.tsx",
    "apps/studio/app/api/life-brain/search/route.ts",
    "apps/studio/app/api/life-brain/context/route.ts",
  ];

  it("documents planned Daily Admin OS routes in docs/daily-admin-os.md", () => {
    const doc = read("docs/daily-admin-os.md");
    for (const route of plannedRoutes) {
      const slug = route.split("/")[3];
      assert.match(doc, new RegExp(slug), `docs/daily-admin-os.md should mention /${slug}`);
    }
  });
});

describe("integration smoke — Portal routes", () => {
  const portalRoutes = [
    "apps/portal/app/page.tsx",
    "apps/portal/app/login/page.tsx",
    "apps/portal/app/worlds/page.tsx",
    "apps/portal/app/worlds/[worldSlug]/page.tsx",
    "apps/portal/app/auth/worlds/page.tsx",
  ];

  for (const route of portalRoutes) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route), `Missing portal route: ${route}`);
    });
  }
});

describe("integration smoke — minimal app access paths", () => {
  it("defines runnable Studio and Portal app scripts", () => {
    const studio = JSON.parse(read("apps/studio/package.json")) as {
      scripts?: Record<string, string>;
    };
    const portal = JSON.parse(read("apps/portal/package.json")) as {
      scripts?: Record<string, string>;
    };

    assert.match(studio.scripts?.dev ?? "", /next dev --port 3000/);
    assert.match(studio.scripts?.start ?? "", /next start --port 3000/);
    assert.match(portal.scripts?.dev ?? "", /next dev --port 3001/);
    assert.match(portal.scripts?.start ?? "", /next start --port 3001/);
  });

  it("keeps Studio login reachable and protects admin routes without auth", () => {
    assert.ok(exists("apps/studio/app/login/page.tsx"));
    assert.ok(exists("apps/studio/app/studio/page.tsx"));
    assert.ok(exists("apps/studio/app/forgot-password/page.tsx"));
    assert.ok(exists("apps/studio/app/reset-password/page.tsx"));
    assert.ok(exists("apps/studio/app/admin/layout.tsx"));

    const middleware = read("apps/studio/middleware.ts");
    const rootLayout = read("apps/studio/app/layout.tsx");
    const adminLayout = read("apps/studio/app/admin/layout.tsx");
    const landing = read("apps/studio/app/page.tsx");

    assert.match(middleware, /PUBLIC_PATH_PREFIXES[\s\S]*"\/login"/);
    assert.match(middleware, /PUBLIC_PATH_PREFIXES[\s\S]*"\/forgot-password"/);
    assert.match(middleware, /config\.authRequired[\s\S]*!isPublicPath\(pathname\)/);
    assert.match(middleware, /loginUrl\.pathname = "\/login"/);
    assert.match(rootLayout, /enforceStudioPageAuth\(pathname\)/);
    assert.match(adminLayout, /requireAdminAccess\(\)/);
    assert.match(landing, /UweLandingPage/);
  });

  it("documents auth flow roadmap and QA matrix", () => {
    assert.ok(exists("docs/ROADMAP.md"));
    assert.ok(exists("docs/SECURITY_QA_MATRIX.md"));
    const roadmap = read("docs/ROADMAP.md");
    assert.match(roadmap, /E2E-Tests/);
    assert.match(roadmap, /2FA/);
    assert.match(roadmap, /PostgreSQL/);
  });

  it("keeps Portal public pages reachable", () => {
    const middleware = read("apps/portal/middleware.ts");
    const home = read("apps/portal/app/page.tsx");

    assert.match(middleware, /"\/"/);
    assert.match(middleware, /"\/worlds\/:path\*"/);
    assert.match(middleware, /"\/forgot-password"/);
    assert.match(middleware, /"\/reset-password"/);
    assert.match(home, /UweLandingPage/);
    assert.ok(exists("apps/portal/app/login/page.tsx"));
    assert.ok(exists("apps/portal/app/forgot-password/page.tsx"));
    assert.ok(exists("apps/portal/app/reset-password/page.tsx"));
  });

  it("keeps DM-only content covered by public leak regression tests", () => {
    const visibilityTest = read("packages/database/src/visibility-security.test.ts");
    assert.match(visibilityTest, /dm_only content must NEVER be readable through portal contexts/);
    assert.match(visibilityTest, /hides dm_only pages from portal page listings/);
    assert.match(visibilityTest, /dm_only block leaked into portal page/);
  });
});

describe("integration smoke — security (no secrets in client code)", () => {
  const clientDirs = [
    path.join(root, "apps/studio/components"),
    path.join(root, "apps/portal/src/components"),
    path.join(root, "packages/shared-ui/src"),
  ];

  for (const dir of clientDirs) {
    if (!fs.existsSync(dir)) continue;

    const files = listFiles(dir, /\.(tsx|ts|jsx|js)$/);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const isClient = content.includes('"use client"') || file.includes("MobileComponents");

      if (!isClient) continue;

      for (const pattern of FORBIDDEN_CLIENT_SECRET_PATTERNS) {
        it(`${path.relative(root, file)} must not reference ${pattern.source}`, () => {
          assert.doesNotMatch(
            content,
            pattern,
            `Secret env var leaked in client file: ${file}`,
          );
        });
      }
    }
  }
});

describe("integration smoke — DnD generator AI tasks", () => {
  const tasksSource = read("packages/ai-brain/src/tasks.ts");
  const actionsSource = read("packages/ai-brain/src/actions.ts");
  const privacySource = read("packages/ai-brain/src/privacy.ts");

  const requiredTasks = [
    "create_npc",
    "create_location",
    "fill_dungeon_room",
    "create_encounter",
    "create_player_handout",
    "detect_contradictions",
    "prepare_next_session",
    "prepare_canon_check",
  ];

  for (const task of requiredTasks) {
    it(`defines AI task ${task}`, () => {
      assert.match(tasksSource, new RegExp(task));
    });
  }

  it("marks player-safe tasks in buildTaskSystemPrompt", () => {
    assert.match(tasksSource, /generate_player_recap/);
    assert.match(tasksSource, /create_player_handout/);
    assert.match(tasksSource, /GM-Geheimnisse/);
  });

  it("exposes brain actions for DnD generator workflows", () => {
    assert.match(actionsSource, /next_session_prep/);
    assert.match(actionsSource, /canon_check/);
    assert.match(actionsSource, /player_handout/);
    assert.match(actionsSource, /fill_dungeon_room/);
  });

  it("blocks cloud provider when context has local knowledge", () => {
    assert.match(privacySource, /contextContainsLocalKnowledge/);
    assert.match(privacySource, /isCloudProvider/);
  });
});

describe("integration smoke — AI security policy module", () => {
  it("includes centralized ai-policy module", () => {
    assert.ok(
      exists("packages/security/src/security/ai-policy.ts"),
      "Missing packages/security/src/security/ai-policy.ts",
    );
    const policy = read("packages/security/src/security/ai-policy.ts");
    assert.match(policy, /requireAiRole|canUseAi/);
    assert.match(policy, /validatePromptLength/);
    assert.match(policy, /resolveEffectiveAllowDmOnly/);
  });

  it("protects unauthenticated AI routes", () => {
    const dndGenerator = read("apps/studio/app/api/dnd-generator/route.ts");
    const inferenceTest = read("apps/studio/app/api/inference/test-prompt/route.ts");
    assert.match(dndGenerator, /requireStudioApiAuth|guardStudioMutation/);
    assert.match(inferenceTest, /requireStudioApiAuth|guardStudioMutation/);
  });
});

describe("integration smoke — security test coverage", () => {
  const securityTests = [
    "packages/security/src/security/ai-policy.test.ts",
    "packages/ai-brain/src/privacy.test.ts",
    "packages/ai-brain/src/router/router.test.ts",
    "packages/ai-brain/src/inference.test.ts",
    "packages/database/src/visibility-security.test.ts",
    "packages/database/src/production-safety.test.ts",
    "packages/database/src/security-dashboard.test.ts",
    "packages/auth/src/security-access.test.ts",
    "packages/database/src/system-status.test.ts",
    "apps/studio/src/lib/studio-api-auth.test.ts",
    "apps/studio/src/admin-status.test.ts",
    "packages/security-tests/src/public-leak-scanner.test.ts",
    "packages/security-tests/src/role-matrix.test.ts",
    "packages/security-tests/src/route-authz.test.ts",
  ];

  for (const testFile of securityTests) {
    it(`includes ${testFile}`, () => {
      assert.ok(exists(testFile), `Missing security test: ${testFile}`);
    });
  }
});

describe("integration smoke — Media, Calendar, DnD & Agent routes", () => {
  const integrationRoutes = [
    "apps/studio/app/image-studio/page.tsx",
    "apps/studio/app/calendar/page.tsx",
    "apps/studio/app/admin/agent-jobs/page.tsx",
    "apps/studio/app/admin/security/page.tsx",
    "apps/studio/app/worlds/[worldSlug]/dnd-api/page.tsx",
    "apps/studio/app/api/image-studio/route.ts",
    "apps/studio/app/api/calendar/events/route.ts",
    "apps/studio/app/api/calendar/feeds/route.ts",
    "apps/studio/app/api/agent-jobs/route.ts",
    "apps/studio/app/api/dnd-api/route.ts",
    "packages/calendar/src/index.ts",
    "packages/dnd-api/src/index.ts",
    "packages/image-studio/src/index.ts",
    "packages/agent-jobs/src/index.ts",
    ".github/workflows/cursor-agent.yml",
  ];

  for (const route of integrationRoutes) {
    it(`includes ${route}`, () => {
      assert.ok(exists(route), `Missing integration route/module: ${route}`);
    });
  }
});

describe("integration smoke — documentation", () => {
  const requiredDocs = [
    "docs/daily-admin-os.md",
    "docs/life-brain-privacy.md",
    "docs/dnd-generator-upgrade.md",
    "docs/PRODUCTION.md",
    "docs/PR_REVIEW_LOG.md",
    "docs/REPO_AUDIT.md",
    "docs/FEATURE_MATURITY_MATRIX.md",
    "docs/engineering/performance.md",
    "docs/engineering/tag-taxonomy.md",
    "docs/engineering/cleanup-inventory.md",
    "docs/AGENT_JOBS.md",
    "docs/IMAGE_STUDIO.md",
    "docs/CALENDAR_INTEGRATION.md",
    "docs/DND_API_INTEGRATION.md",
    "docs/SECURITY_SETTINGS.md",
    "docs/security-testing.md",
    "docs/TEST_PLAN.md",
    "SECURITY_NOTES.md",
    "CHANGELOG.md",
  ];

  for (const doc of requiredDocs) {
    it(`includes ${doc}`, () => {
      assert.ok(exists(doc), `Missing documentation: ${doc}`);
    });
  }
});

describe("integration smoke — mobile navigation", () => {
  it("defines global bottom nav items", () => {
    const nav = read("apps/studio/src/lib/mobile-nav.ts");
    assert.match(nav, /studioGlobalBottomNav/);
    assert.match(nav, /studioWorldBottomNav/);
  });

  it("includes MobileBottomNav component", () => {
    const mobile = read("packages/shared-ui/src/MobileComponents.tsx");
    assert.match(mobile, /MobileBottomNav/);
    assert.match(mobile, /PageListCards/);
  });
});

describe("integration smoke — env and secrets", () => {
  it("includes centralized env validation", () => {
    assert.ok(exists("packages/env/src/config/env.ts"));
    assert.ok(exists("docs/secrets.md"));
    assert.ok(exists("apps/studio/instrumentation.ts"));
    assert.ok(exists("apps/portal/instrumentation.ts"));
  });

  it("documents secret scan script", () => {
    const scripts = readPackageScripts();
    assert.ok(scripts["secret:scan"]);
    assert.ok(scripts["audit:prod"]);
  });
});

describe("integration smoke — agent CI quality gate", () => {
  it("documents agent quality requirements", () => {
    assert.ok(exists("AGENTS.md"));
    const agents = read("AGENTS.md");
    assert.match(agents, /pnpm quality/);
    assert.match(agents, /no-unused-vars|unused imports/i);
  });

  it("exposes pnpm quality script matching CI pipeline", () => {
    assertScriptIncludesInOrder("quality", [
      "pnpm --filter @uwe/database db:generate",
      "pnpm lint",
      "pnpm secret:scan",
      "pnpm typecheck",
      "pnpm test",
      "pnpm test:security",
      "pnpm audit:prod",
      "pnpm build:release",
    ]);
  });

  it("includes ci-quality-gate Cursor skill", () => {
    assert.ok(exists(".cursor/skills/ci-quality-gate/SKILL.md"));
    const skill = read(".cursor/skills/ci-quality-gate/SKILL.md");
    assert.match(skill, /name:\s*ci-quality-gate/);
    assert.match(skill, /pnpm quality/);
  });

  it("includes performance-tags-cleanup skill and perf modules", () => {
    assert.ok(exists(".cursor/skills/uwe-performance-tags-cleanup/SKILL.md"));
    assert.ok(exists("packages/database/src/perf-smoke.test.ts"));
    assert.ok(exists("packages/database/src/tag-service.ts"));
    assert.ok(exists("scripts/migration-check.mjs"));
    assert.ok(exists("apps/studio/app/admin/tags/page.tsx"));
    assert.ok(exists("apps/studio/app/api/admin/tags/route.ts"));
    assert.ok(exists("scripts/bundle-budget-check.mjs"));
  });

  it("exposes pnpm ci:light script for PR gate", () => {
    assertScriptIncludesInOrder("ci:light", [
      "pnpm --filter @uwe/database db:generate",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test:ci",
      "pnpm secret:scan",
      "pnpm docs:check",
    ]);
  });

  it("runs light gate in PR check workflow", () => {
    const prCheck = read(".github/workflows/pr-check.yml");
    assert.match(prCheck, /pull_request:/);
    assert.match(prCheck, /pnpm ci:light/);
    assert.doesNotMatch(prCheck, /pnpm quality/);
  });

  it("runs full quality gate only on main CI workflow", () => {
    const ci = read(".github/workflows/ci.yml");
    assert.match(ci, /pnpm quality/);
    assert.doesNotMatch(ci, /pull_request:/);
    const qualityIndex = ci.indexOf("pnpm quality");
    const dockerIndex = ci.indexOf("docker-build:");
    assert.ok(qualityIndex >= 0, "CI must run pnpm quality");
    assert.ok(dockerIndex < 0 || qualityIndex < dockerIndex, "quality must run before docker-build job");
  });

  it("quality script runs security gates before build", () => {
    assertScriptIncludesInOrder("quality", [
      "pnpm secret:scan",
      "pnpm test:security",
      "pnpm audit:prod",
      "pnpm build:release",
      "bundle-budget-check",
    ]);
  });

  it("keeps Docker builds conditional in CI", () => {
    const ci = read(".github/workflows/ci.yml");
    assert.match(ci, /docker-build:/);
    assert.match(ci, /Detect Docker-affecting changes/);
    assert.match(ci, /docker\/build-push-action@v6/);
  });

  it("runs light gate in cursor-agent workflow before push", () => {
    const workflow = read(".github/workflows/cursor-agent.yml");
    assert.match(workflow, /pnpm ci:light/);
    const gateIndex = workflow.indexOf("pnpm ci:light");
    const pushIndex = workflow.indexOf("git push");
    assert.ok(gateIndex >= 0 && pushIndex >= 0);
    assert.ok(gateIndex < pushIndex, "ci:light must run before push");
  });
});

describe("integration smoke — RTX public URL guard", () => {
  it("blocks public inference URLs by default", () => {
    const guard = read("packages/ai-brain/src/inference-url-guard.ts");
    assert.match(guard, /isInferenceUrlAllowed/);
    assert.match(guard, /allowPublicUrl/);
  });

  it("tests public URL blocking", () => {
    const test = read("packages/ai-brain/src/inference.test.ts");
    assert.match(test, /blocks public base URLs when allowPublicUrl is false/);
  });
});
