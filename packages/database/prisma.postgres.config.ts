import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.postgresql.prisma",
  migrations: {
    path: "prisma/migrations-postgresql",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "postgresql://uwe:uwe@localhost:5432/uwe",
  },
});
