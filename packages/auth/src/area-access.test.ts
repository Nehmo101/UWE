import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AiAccessDeniedError,
  AuthRequiredError,
  ForbiddenAccessError,
  canAccessBrain,
  canAccessFamily,
  canAccessPortal,
  canAccessStudio,
  canUseRtxAi,
  getRequiredAccessForApiPath,
  getRequiredAccessForPagePath,
  isOwner,
  requireArea,
  requireOwner,
  requireRtxAi,
  requireUser,
  satisfiesStudioRouteAccess,
  toAreaAccess,
} from "./area-access";
import { NO_AREA_ACCESS, type AuthUser } from "./types";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    displayName: "Test",
    email: "test@uwe.local",
    isOwner: false,
    access: { ...NO_AREA_ACCESS },
    aiAccess: false,
    ...overrides,
  };
}

const owner = user({
  id: "owner",
  isOwner: true,
  access: { portal: true, studio: true, brain: true, family: true },
});
const dm = user({ id: "dm", access: { ...NO_AREA_ACCESS, portal: true, studio: true } });
const player = user({ id: "player", access: { ...NO_AREA_ACCESS, portal: true } });
const nobody = user({ id: "nobody" });

describe("area access", () => {
  it("answers each area from its own checkbox", () => {
    assert.ok(canAccessPortal(player));
    assert.equal(canAccessStudio(player), false);
    assert.equal(canAccessBrain(player), false);
    assert.equal(canAccessFamily(player), false);

    assert.ok(canAccessStudio(dm));
    assert.equal(canAccessBrain(dm), false);

    assert.ok(canAccessBrain(owner));
    assert.ok(canAccessFamily(owner));
  });

  it("keeps owner separate from the four checkboxes", () => {
    assert.ok(isOwner(owner));
    assert.equal(isOwner(dm), false);
    // Ticking every box does not make someone the owner.
    const fullAccess = user({ access: { portal: true, studio: true, brain: true, family: true } });
    assert.equal(isOwner(fullAccess), false);
  });

  it("throws the right error for anonymous vs. unticked", () => {
    assert.throws(() => requireUser(null), AuthRequiredError);
    assert.throws(() => requireArea(nobody, "studio"), ForbiddenAccessError);
    assert.throws(() => requireOwner(dm), ForbiddenAccessError);
    assert.equal(requireArea(dm, "studio"), dm);
    assert.equal(requireOwner(owner), owner);
  });

  it("maps Studio routes to the access they need", () => {
    assert.equal(getRequiredAccessForApiPath("/api/health"), null);
    assert.equal(getRequiredAccessForApiPath("/api/auth/login"), null);
    assert.equal(getRequiredAccessForApiPath("/worlds"), null);
    assert.equal(getRequiredAccessForApiPath("/api/worlds"), "studio");
    assert.equal(getRequiredAccessForApiPath("/api/admin/users"), "owner");

    assert.equal(getRequiredAccessForPagePath("/worlds"), "studio");
    assert.equal(getRequiredAccessForPagePath("/admin/users"), "owner");
    assert.equal(getRequiredAccessForPagePath("/ideas"), "owner");
  });

  it("checks a user against a route requirement", () => {
    assert.ok(satisfiesStudioRouteAccess(player, "public"));
    assert.equal(satisfiesStudioRouteAccess(player, "studio"), false);
    assert.ok(satisfiesStudioRouteAccess(dm, "studio"));
    assert.equal(satisfiesStudioRouteAccess(dm, "owner"), false);
    assert.ok(satisfiesStudioRouteAccess(owner, "owner"));
  });

  it("builds an access record from loose DB booleans", () => {
    assert.deepEqual(toAreaAccess({ portalAccess: true, brainAccess: null }), {
      portal: true,
      studio: false,
      brain: false,
      family: false,
    });
  });
});

/**
 * G-KI — wer darf den RTX-Host beschäftigen.
 *
 * Der Punkt, an dem hier alles hängt, ist die Trennung: die vier Häkchen sagen
 * WELCHE APP, das KI-Flag sagt, ob jemand darin Inferenz auslösen darf. Wer
 * beides in einen Topf wirft, baut entweder ein fünftes App-Häkchen (dann
 * stimmt der Satz „das Häkchen sagt, welche App" nicht mehr) oder gibt jedem
 * mit Studio-Häkchen die KI (dann ist die Einstellung wirkungslos).
 */
describe("canUseRtxAi", () => {
  const dmMitKi = user({ id: "dm-ai", access: { ...NO_AREA_ACCESS, portal: true, studio: true }, aiAccess: true });

  it("der Owner darf immer — auch ohne gesetztes Flag", () => {
    assert.equal(canUseRtxAi(owner), true);
    assert.equal(canUseRtxAi(user({ isOwner: true, aiAccess: false })), true);
  });

  it("ein Studio-Konto ohne Flag darf nicht", () => {
    assert.equal(canUseRtxAi(dm), false);
  });

  it("mit Flag darf es", () => {
    assert.equal(canUseRtxAi(dmMitKi), true);
  });

  it("requireRtxAi trennt „nicht angemeldet“ von „nicht freigeschaltet“", () => {
    assert.throws(() => requireRtxAi(null), AuthRequiredError);
    assert.throws(() => requireRtxAi(dm), AiAccessDeniedError);
    assert.doesNotThrow(() => requireRtxAi(dmMitKi));
    assert.doesNotThrow(() => requireRtxAi(owner));
  });
});

describe("KI-Routen", () => {
  const dmMitKi = user({ id: "dm-ai", access: { ...NO_AREA_ACCESS, portal: true, studio: true }, aiAccess: true });

  it("erkennt die Routen, die Inferenz auslösen", () => {
    for (const pfad of [
      "/api/ai/generate",
      "/api/ai",
      "/api/brain/run",
      "/api/dnd-generator",
      "/api/inference/test-prompt",
      "/api/image-studio",
      "/api/research",
      "/api/worlds/nordmark/brain",
      "/api/worlds/nordmark/inspector/diagnose",
    ]) {
      assert.equal(getRequiredAccessForApiPath(pfad), "ai", pfad);
    }
  });

  it("lässt benachbarte Routen in Ruhe — Lesen ist nicht Erzeugen", () => {
    // Wer eine erzeugte Seite ansehen darf, muss sie nicht erzeugen dürfen.
    for (const pfad of [
      "/api/worlds/nordmark/pages",
      "/api/jobs",
      "/api/import/formats",
      "/api/backup",
      "/api/assets/a1/file",
    ]) {
      assert.equal(getRequiredAccessForApiPath(pfad), "studio", pfad);
    }
  });

  it("/api/admin/* bleibt owner-only, auch wenn dort KI läuft", () => {
    assert.equal(getRequiredAccessForApiPath("/api/admin/ai-gateway"), "owner");
  });

  it("öffentliche Routen bleiben öffentlich", () => {
    assert.equal(getRequiredAccessForApiPath("/api/health"), null);
  });

  it("Seiten, die ohne KI leer wären, verlangen das Flag", () => {
    assert.equal(getRequiredAccessForPagePath("/worlds/nordmark/ai-runs"), "ai");
    assert.equal(getRequiredAccessForPagePath("/worlds/nordmark/brain"), "ai");
    assert.equal(getRequiredAccessForPagePath("/worlds/nordmark/one-shot"), "ai");
    // Eine Seite, die bloss ein KI-Bedienfeld enthält, nicht: sie zeigt auch
    // ohne KI ihren Inhalt.
    assert.equal(getRequiredAccessForPagePath("/worlds/nordmark/pages"), "studio");
  });

  it("„ai“ verlangt BEIDES — Studio-Häkchen und KI-Flag", () => {
    assert.equal(satisfiesStudioRouteAccess(dmMitKi, "ai"), true);
    assert.equal(satisfiesStudioRouteAccess(dm, "ai"), false, "Studio ohne Flag");
    // Portal-Konto mit KI-Flag: das Flag ersetzt das Studio-Häkchen nicht.
    assert.equal(
      satisfiesStudioRouteAccess(user({ access: { ...NO_AREA_ACCESS, portal: true }, aiAccess: true }), "ai"),
      false,
      "Flag ohne Studio-Häkchen",
    );
    assert.equal(satisfiesStudioRouteAccess(owner, "ai"), true);
  });

  it("„studio“ bleibt unverändert — das KI-Flag verengt nichts anderes", () => {
    assert.equal(satisfiesStudioRouteAccess(dm, "studio"), true);
    assert.equal(satisfiesStudioRouteAccess(player, "studio"), false);
  });
});
