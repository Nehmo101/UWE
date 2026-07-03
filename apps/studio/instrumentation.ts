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
  }
}
