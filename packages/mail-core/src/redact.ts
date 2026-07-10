export { redactError, redactSecrets } from "@uwe/env";

export function maskEmailList(addresses: string[]): string[] {
  return addresses.map((address) => {
    const at = address.indexOf("@");
    if (at <= 1) return "***";
    return `${address.slice(0, 1)}***${address.slice(at)}`;
  });
}

export function truncateBodyPreview(body: string, maxLength = 200): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}…`;
}
