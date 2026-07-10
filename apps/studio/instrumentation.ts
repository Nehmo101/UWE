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
    const { getSharedPrismaClient } = await import("@uwe/database/client");
    try {
      await getSharedPrismaClient().systemSettings.findFirst({ select: { id: true } });
    } catch {
      // Boot-time DB not ready — first layout load uses safe fallbacks.
    }
    // Boot-time job recovery: the runner keeps in-flight jobs in an in-memory Set,
    // so after a restart any job left "running" is orphaned and any "pending" job
    // was never dispatched. Sweep once (skipped during `next build`). The recovery
    // function is idempotent and swallows its own errors, so it never crashes boot.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { recoverInterruptedJobsAtBoot } = await import("./src/lib/job-executor");
      await recoverInterruptedJobsAtBoot();
    }
  }
}
