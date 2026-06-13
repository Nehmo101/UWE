import http from "node:http";

export interface HealthWaitOptions {
  url: string;
  timeoutMs?: number;
  intervalMs?: number;
}

export async function waitForHealth(options: HealthWaitOptions): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 1_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const ok = await checkHealthUrl(options.url);
    if (ok) {
      return true;
    }

    await sleep(intervalMs);
  }

  return false;
}

export function checkHealthUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 400);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(3_000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
