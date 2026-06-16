import fs from "node:fs";
import path from "node:path";

/**
 * Writes a file atomically by creating a temp file in the same directory
 * and renaming it into place (POSIX rename is atomic on the same filesystem).
 */
export function writeFileAtomic(targetPath: string, data: Buffer | string): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });

  const tempPath = path.join(
    dir,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Best-effort cleanup of the temp file.
    }
    throw error;
  }
}
