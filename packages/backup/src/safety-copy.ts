import path from "node:path";
import { exportBackupZip } from "./export";
import { ensureBackupsDir } from "./paths";
import type { CreateBackupOptions } from "./types";

/**
 * Creates a full safety backup before a destructive restore operation.
 * The filename is prefixed with `pre-restore-` for easy identification.
 */
export async function createPreRestoreSafetyCopy(
  databaseUrl?: string,
  options?: Pick<CreateBackupOptions, "uploadsRoot" | "outputDir">,
): Promise<{ filename: string; path: string }> {
  const backupsDir = ensureBackupsDir(options?.outputDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tempOptions: CreateBackupOptions = {
    type: "full",
    format: "zip",
    uploadsRoot: options?.uploadsRoot,
    outputDir: backupsDir,
  };

  const { outputPath } = await exportBackupZip(databaseUrl, tempOptions);
  const safetyFilename = `pre-restore-${timestamp}.zip`;
  const safetyPath = path.join(backupsDir, safetyFilename);

  const fs = await import("node:fs");
  fs.renameSync(outputPath, safetyPath);

  return { filename: safetyFilename, path: safetyPath };
}
