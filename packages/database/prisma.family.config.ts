import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migration config for the shared Family database (uwe-family.db). Mirrors
// prisma.brain.config.ts: the standalone family schema has no datasource url
// (it runs through a driver adapter at runtime — see src/family-client.ts), so
// the url for `migrate deploy`/`migrate dev` is supplied here from
// FAMILY_DATABASE_URL. Keep the default in sync with resolveFamilyDatabaseUrl().
export default defineConfig({
  schema: "prisma/family/schema.prisma",
  migrations: {
    path: "prisma/family/migrations",
  },
  datasource: {
    url: process.env["FAMILY_DATABASE_URL"] ?? "file:./data/uwe-family.db",
  },
});
