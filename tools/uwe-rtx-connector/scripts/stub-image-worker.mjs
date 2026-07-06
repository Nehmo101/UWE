#!/usr/bin/env node
/**
 * Bundled stub image worker for connector smoke tests and homelab defaults.
 * Reads JSON from stdin, writes a minimal success payload to stdout.
 */
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
      imageUrl: "file:///tmp/uwe-stub-image.png",
      prompt,
      provider: "stub",
    }),
  );
});
