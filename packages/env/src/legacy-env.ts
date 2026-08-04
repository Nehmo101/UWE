/**
 * Warnt laut vor gesetzten `RTX_*`-Umgebungsvariablen.
 *
 * Der Maschinenraum-Umzug (docs/engineering/engine-rename-migration.md) hat
 * jede `RTX_*`-Variable in `ENGINE_*` umbenannt — ohne Fallback. Eine `.env`
 * mit `RTX_BASE_URL` wird sonst stillschweigend ignoriert, und UWE verhält
 * sich, als wäre kein Worker konfiguriert. Die Kombination „kein Fallback +
 * stilles Ignorieren" ist betriebsgefährlich; deshalb sagt der Start es laut.
 *
 * Bewusst nur eine Warnung, kein Abbruch: Eine vergessene Alt-Variable darf
 * den Betrieb nicht verhindern — nur nicht unbemerkt bleiben.
 */
export function warnAboutLegacyRtxEnvVars(
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = (message) => console.warn(message),
): string[] {
  const legacyKeys = Object.keys(env)
    .filter((key) => key.startsWith("RTX_"))
    .sort();

  if (legacyKeys.length === 0) {
    return [];
  }

  warn(
    [
      "⚠️  RTX_*-Umgebungsvariablen gefunden — sie werden seit dem Maschinenraum-Umzug IGNORIERT:",
      ...legacyKeys.map((key) => `    ${key}  →  ${key.replace(/^RTX_/, "ENGINE_")}`),
      "    Benenne sie in ENGINE_* um (z. B. `sed -i 's/^RTX_/ENGINE_/' .env`).",
      "    Details: docs/engineering/engine-rename-migration.md",
    ].join("\n"),
  );

  return legacyKeys;
}
