import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader (no dotenv dependency): populates `DATABASE_URL` /
 * `BRAIN_DATABASE_URL` and friends from the monorepo-root `.env` for keys that
 * are not already set, so a Command Center CLI talks to the same host database
 * as the running apps.
 *
 * Shared by every CLI in this package — it used to be copy-pasted per file.
 */
export function loadEnvFromRoot(cwd: string = process.cwd()): void {
  const envPath = path.join(cwd, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Reads the whole of stdin — how CLIs in this package receive secrets. */
export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

/** Parses stdin as JSON, tolerating an empty body. */
export async function readStdinJson<T>(): Promise<Partial<T>> {
  const raw = (await readStdin()).trim();
  return raw ? (JSON.parse(raw) as Partial<T>) : {};
}
