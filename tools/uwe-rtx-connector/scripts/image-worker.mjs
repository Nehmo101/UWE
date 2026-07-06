#!/usr/bin/env node
/**
 * Production-oriented bundled image worker for the RTX Host Connector.
 *
 * Contract (stdin JSON → stdout JSON):
 *   Input:  { task, prompt, source_image?, mask?, width?, height? }
 *   Output: { image: "<base64>", mime_type: "image/png" }
 *
 * When UWE_IMAGE_BACKEND_URL is set, proxies to that HTTP endpoint (POST JSON,
 * expects the same response shape). Otherwise returns a deterministic 1×1 PNG
 * so homelab smoke tests and connector routing stay verifiable without GPU.
 */
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PpIhjQAAAABJRU5ErkJggg==";

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    throw new Error("image worker: invalid JSON on stdin");
  }

  const backendUrl = process.env.UWE_IMAGE_BACKEND_URL?.trim();
  if (backendUrl) {
    const token = process.env.UWE_IMAGE_BACKEND_TOKEN?.trim();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${backendUrl.replace(/\/+$/, "")}/v1/images`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task: payload.task ?? "generate",
        prompt: payload.prompt ?? "",
        source_image: payload.source_image,
        mask: payload.mask,
        width: payload.width ?? 1024,
        height: payload.height ?? 1024,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`image backend HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const data = await response.json();
    process.stdout.write(JSON.stringify(data));
    return;
  }

  process.stdout.write(
    JSON.stringify({
      image: PNG_1X1_BASE64,
      mime_type: "image/png",
      prompt: typeof payload.prompt === "string" ? payload.prompt : "",
      provider: "bundled",
      width: payload.width ?? 1024,
      height: payload.height ?? 1024,
    }),
  );
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
