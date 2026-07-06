const USER_QUERY_STOPWORDS = new Set([
  "die",
  "der",
  "das",
  "den",
  "dem",
  "des",
  "the",
  "a",
  "an",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "user",
  "benutzer",
  "nutzer",
  "account",
  "globale",
  "global",
  "rolle",
  "role",
]);

function isUserQueryStopword(token: string): boolean {
  return USER_QUERY_STOPWORDS.has(token.toLowerCase());
}

export function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function extractWorldQuery(text: string): string | null {
  const quoted = text.match(/\b(?:in|für|for|world|welt)\s+(["'])([^"']+)\1/i);
  if (quoted?.[2]) {
    return quoted[2].trim();
  }
  const plain = text.match(/\b(?:in|für|for|world|welt)\s+([a-z0-9_-]+)/i);
  return plain?.[1]?.trim() ?? null;
}

export function extractUserQuery(text: string): string | null {
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (emailMatch?.[0]) {
    return emailMatch[0];
  }

  const userLabel = text.match(/\b(?:user|benutzer|nutzer)\s+(\S+)/i);
  if (userLabel?.[1]) {
    return userLabel[1].replace(/[.,;]+$/, "");
  }

  const roleOfUser = text.match(
    /\b(?:rolle\s+von|role\s+of)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (roleOfUser?.[1] && !isUserQueryStopword(roleOfUser[1])) {
    return roleOfUser[1];
  }

  const machUser = text.match(
    /\b(?:mach|mache|make|setze|set|assign|weise)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (machUser?.[1] && !isUserQueryStopword(machUser[1])) {
    return machUser[1];
  }

  const promoteUser = text.match(
    /\b(?:promote|befördere|ernenne)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (promoteUser?.[1] && !isUserQueryStopword(promoteUser[1])) {
    return promoteUser[1];
  }

  const removeUser = text.match(
    /\b(?:entferne|remove|delete)\s+([a-zäöüß0-9._-]+)/i,
  );
  if (removeUser?.[1]) {
    return removeUser[1];
  }

  const disableUser = text.match(
    /\b(?:deaktiviere|disable|sperre)\s+(?:benutzer|user|nutzer|account)?\s*([a-zäöüß0-9._-]+)/i,
  );
  if (disableUser?.[1]) {
    return disableUser[1];
  }

  const enableUser = text.match(
    /\b(?:aktiviere|enable|freischalte)\s+(?:benutzer|user|nutzer|account)?\s*([a-zäöüß0-9._-]+)/i,
  );
  if (enableUser?.[1]) {
    return enableUser[1];
  }

  return null;
}
