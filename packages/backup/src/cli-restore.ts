#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { createPrismaClient } from "@uwe/database/server";
import { createBrainPrismaClient } from "@uwe/database/brain-client";
import { createFamilyPrismaClient } from "@uwe/database/family-client";
import { executeRestore } from "./restore";
import { readBackupZip } from "./archive";

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) {
    throw new Error("Usage: cli-restore.ts <backup.zip>");
  }

  const resolved = path.resolve(backupPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Backup not found: ${resolved}`);
  }

  const zipBuffer = fs.readFileSync(resolved);
  const bundle = readBackupZip(zipBuffer);
  const db = createPrismaClient(process.env.DATABASE_URL);
  const brainDb = createBrainPrismaClient();
  const familyDb = createFamilyPrismaClient();

  try {
    const result = await executeRestore(
      db,
      brainDb,
      familyDb,
      bundle,
      {
        confirmed: true,
        skipExisting: false,
        allowUpdates: true,
        autoResolveSlugConflicts: true,
      },
      zipBuffer,
      process.env.UPLOADS_DIR,
    );

    console.log(
      `Restore completed: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`,
    );

    if (result.errors.length > 0) {
      console.error(result.errors.join("\n"));
      process.exit(1);
    }
  } finally {
    await db.$disconnect();
    await brainDb.$disconnect();
    await familyDb.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
