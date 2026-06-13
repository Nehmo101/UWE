const SECRET_PATTERNS = [
  /password[=:]\s*\S+/gi,
  /smtp[_-]?pass(?:word)?[=:]\s*\S+/gi,
  /authorization:\s*\S+/gi,
  /bearer\s+[a-z0-9._-]+/gi,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

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
