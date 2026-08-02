/**
 * Welche Routen ohne Shell rendern.
 *
 * Seit der Shell im Root-Layout sitzt, ist das eine Entscheidung des Layouts
 * und keine mehr der einzelnen Seite. Ohne Rahmen laufen genau die Routen, die
 * entweder gar keinen Arbeitsbereich zeigen (Landing, Login, Logout,
 * Passwort-Reset, Ersteinrichtung) oder in denen jedes Navigationsziel ins
 * Leere führte.
 *
 * `/maintenance` gehört zur zweiten Gruppe: im Wartungsmodus leitet alles
 * andere dorthin zurück, eine vollständige Seitenleiste böte dort also
 * ausschließlich Sackgassen an — und die Seite ist ohne Anmeldung erreichbar.
 *
 * Die Liste deckt sich absichtlich mit den Ausnahmen in
 * `enforceStudioPageAuth` (`src/lib/auth.ts`): der Shell setzt eine
 * angemeldete Sitzung voraus, und genau dort wird sie nicht erzwungen.
 */
const CHROMELESS_PREFIXES = [
  "/login",
  "/logout",
  "/setup",
  "/maintenance",
  "/forgot-password",
  "/reset-password",
] as const;

export function isChromelessStudioPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? "/";
  // Die Wurzel ist entweder die öffentliche Landing oder ein Redirect in den
  // Arbeitsbereich — beides ohne Shell.
  if (path === "/" || path === "") return true;
  return CHROMELESS_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
