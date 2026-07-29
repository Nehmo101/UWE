import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Lade-Test für die Ops-Brücke.
 *
 * Die Kommandozentrale startet `ops-cli.ts` mit `node --import tsx` aus dem
 * Monorepo-Wurzelverzeichnis. In genau diesem Modus lieferte
 * `@uwe/database/deployment` hinter einem `export *` nur `default`, und jede
 * Cloudflare-Aktion brach schon beim Laden ab („does not provide an export
 * named resolveCloudflareEdgeCredentials") — Typecheck und die Unit-Tests der
 * Pakete blieben dabei grün, weil sie andere Auflösungswege nehmen.
 *
 * Der Test importiert deshalb dynamisch über den Paketnamen, aus diesem Paket
 * heraus: derselbe Weg wie im Betrieb.
 */
describe("ops bridge imports", () => {
  it("resolves the deployment subpath with its named exports", async () => {
    const deployment = await import("@uwe/database/deployment");

    for (const name of [
      "resolveCloudflareEdgeCredentials",
      "buildDeploymentSettingsUpdate",
      "buildDeploymentEnvOverrides",
      "sanitizeDeploymentSettingsForClient",
      "normalizeDeploymentSettings",
    ]) {
      assert.ok(name in deployment, `Export fehlt zur Laufzeit: ${name}`);
    }
  });

  it("resolves the auth package for the Turnstile status", async () => {
    const auth = await import("@uwe/auth");
    assert.equal(typeof auth.getTurnstileConfig, "function");
  });

  it("loads every Cloudflare ops module", async () => {
    const challenge = await import("./cloudflare-challenge-ops.ts");
    assert.equal(typeof challenge.getManagedChallengeStatus, "function");
    assert.equal(typeof challenge.setManagedChallenge, "function");

    const tunnel = await import("./cloudflare-tunnel-ops.ts");
    assert.equal(typeof tunnel.getTunnelIngressStatus, "function");
    assert.equal(typeof tunnel.applyTunnelIngressNow, "function");

    const turnstile = await import("./turnstile-ops.ts");
    assert.equal(typeof turnstile.getTurnstileStatus, "function");
    assert.equal(typeof turnstile.setTurnstile, "function");
  });
});
