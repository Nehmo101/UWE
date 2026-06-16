import { assertProductionEnvReady } from "@uwe/env";

try {
  assertProductionEnvReady();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
