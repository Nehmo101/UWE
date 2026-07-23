import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migration config for the owner-private Brain database (uwe-brain.db). Mirrors
// prisma.postgres.config.ts: the standalone brain schema has no datasource url
// (it runs through a driver adapter at runtime — see src/brain-client.ts), so
// the url for `migrate deploy`/`migrate dev` is supplied here from
// BRAIN_DATABASE_URL. Keep the default in sync with resolveBrainDatabaseUrl().
export default defineConfig({
  schema: "prisma/brain/schema.prisma",
  migrations: {
    path: "prisma/brain/migrations",
  },
  datasource: {
    url: process.env["BRAIN_DATABASE_URL"] ?? "file:./data/uwe-brain.db",
  },
});
