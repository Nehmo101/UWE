export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionEnvReady } = await import("@uwe/env");
    assertProductionEnvReady();
    const { enforceEnvSafetyAtBoot } = await import("@uwe/auth");
    // Hard abort in production when blocking env issues exist (weak AUTH_SECRET,
    // dev media signing secret, RUN_DB_SEED, …); warning only in dev/test.
    enforceEnvSafetyAtBoot();
    const { bootstrapRateLimitStore } = await import("@uwe/security");
    bootstrapRateLimitStore();
    // Load owner-configured deployment/routing/security overrides from the DB so they
    // are effective from the first request (env stays the fallback). Never throws.
    const { refreshDeploymentRuntimeOverrides } = await import("@uwe/database/deployment");
    await refreshDeploymentRuntimeOverrides();
    const { getSharedPrismaClient } = await import("@uwe/database/server");
    try {
      await getSharedPrismaClient().systemSettings.findFirst({ select: { id: true } });
    } catch {
      // Boot-time DB not ready — first layout load uses safe fallbacks.
    }
  }
}
