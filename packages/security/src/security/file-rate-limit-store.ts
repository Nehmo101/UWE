import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export interface FileRateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

export interface FileRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface FileRateLimitStoreLike {
  check(key: string, options: FileRateLimitOptions): FileRateLimitResult;
  reset(key: string): void;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export class FileRateLimitStore implements FileRateLimitStoreLike {
  constructor(private readonly directory: string) {
    fs.mkdirSync(directory, { recursive: true });
  }

  check(key: string, options: FileRateLimitOptions): FileRateLimitResult {
    const filePath = path.join(this.directory, `${hashKey(key)}.json`);
    const now = Date.now();
    const windowStart = now - options.windowMs;

    let attempts: number[] = [];
    if (fs.existsSync(filePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { attempts?: number[] };
        attempts = (parsed.attempts ?? []).filter((ts) => ts > windowStart);
      } catch {
        attempts = [];
      }
    }

    if (attempts.length >= options.maxAttempts) {
      const oldest = attempts[0]!;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
      fs.writeFileSync(filePath, JSON.stringify({ attempts }), "utf8");
      return { allowed: false, retryAfterSeconds };
    }

    attempts.push(now);
    fs.writeFileSync(filePath, JSON.stringify({ attempts }), "utf8");
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key: string): void {
    const filePath = path.join(this.directory, `${hashKey(key)}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
