#!/usr/bin/env node
/**
 * Bundled stub image worker for connector smoke tests and homelab defaults.
 * Reads JSON from stdin, writes a connector-compatible result to stdout.
 */
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PpIhjQAAAABJRU5ErkJggg==";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(input || "{}");
  } catch {
    payload = {};
  }
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "image";
  process.stdout.write(
    JSON.stringify({
      image: PNG_1X1_BASE64,
      mime_type: "image/png",
      prompt,
      provider: "stub",
    }),
  );
});
