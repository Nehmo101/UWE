import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export function createTestDatabaseUrl(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-db-"));
  const dbPath = path.join(tempDir, "test.db");
  const databaseUrl = `file:${dbPath}`;

  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(packageRoot, ".."),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: "pipe",
  });

  return databaseUrl;
}
