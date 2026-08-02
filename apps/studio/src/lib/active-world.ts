/**
 * Aktive Welt — der Welt-Kontext des Studio-Shells.
 *
 * Bis zur Shell-Zusammenführung war „die aktive Welt" kein Zustand, sondern ein
 * Nebeneffekt der URL: nur unter `/worlds/<slug>/**` gab es überhaupt eine, und
 * beim Verlassen war sie weg. Der Cookie hier hält sie über den Routenwechsel
 * hinweg, damit der Welt-Block der Seitenleiste auch auf `/search` oder
 * `/settings` stehen bleibt und der Rückweg in die Welt ein Klick ist.
 *
 * Abgrenzung zu `world-last-route.ts`: dort steht **pro Welt** die zuletzt
 * besuchte Unterroute (`uwe_world_route_<slug>`), hier steht, **welche** Welt
 * zuletzt aktiv war. Beide zusammen ergeben den Sprung zurück an die Stelle,
 * an der man aufgehört hat — der Welt-Switcher zielt deshalb auf
 * `/worlds/<slug>` und lässt den dortigen Redirect die Unterroute wählen.
 */

/** Cookie mit dem Slug der zuletzt aktiven Welt. */
export const ACTIVE_WORLD_COOKIE = "uwe_active_world";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/**
 * Slug-Form, wie sie `packages/security` für Welten erzwingt. Der Cookie kommt
 * vom Client und wird deshalb wie jede andere Eingabe behandelt — ein
 * gültiges Format allein reicht aber nicht, siehe `resolveActiveWorldSlug`.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Prüft die reine Form eines Slugs (kein Nachweis, dass die Welt existiert). */
export function isWorldSlugShape(value: string): boolean {
  return value.length > 0 && value.length <= 128 && SLUG_PATTERN.test(value);
}

/** Welt-Slug aus einem Studio-Pfad, oder `null` außerhalb einer Welt. */
export function worldSlugFromPathname(pathname: string): string | null {
  const match = /^\/worlds\/([^/?#]+)/.exec(pathname);
  if (!match) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  return isWorldSlugShape(slug) ? slug : null;
}

/** Live-Session-Kennung aus dem Pfad — schaltet den Welt-Block in den Live-Modus. */
export function liveSessionIdFromPathname(pathname: string): string | null {
  const match = /^\/worlds\/[^/]+\/sessions\/([^/?#]+)\/live(?:\/|$)/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

/**
 * Ein Kandidat zählt nur, wenn es die Welt wirklich gibt. Ein Cookie auf eine
 * gelöschte oder erfundene Welt darf keinen Welt-Block erzeugen — sonst zeigte
 * die Seitenleiste Ziele, die beim Klick auf 404 laufen.
 */
export function pickKnownWorldSlug(
  candidate: string | null | undefined,
  knownSlugs: readonly string[],
): string | null {
  if (!candidate) return null;
  if (!isWorldSlugShape(candidate)) return null;
  return knownSlugs.includes(candidate) ? candidate : null;
}

/**
 * Roher Cookie-Wert → dekodierter Slug in gültiger Form, sonst `null`.
 *
 * Der Cookie ist Client-Eingabe. Wer ihn ohne Weltliste auswertet (etwa der
 * `/portal`-Redirect), soll wenigstens nicht für beliebigen Inhalt eine
 * Datenbankabfrage absetzen.
 */
export function decodeWorldSlugCookie(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(cookieValue);
  } catch {
    return null;
  }
  return isWorldSlugShape(decoded) ? decoded : null;
}

/** Cookie-Wert → geprüfter Slug einer existierenden Welt. Für den Shell. */
export function readActiveWorldCookie(
  cookieValue: string | null | undefined,
  knownSlugs: readonly string[],
): string | null {
  return pickKnownWorldSlug(decodeWorldSlugCookie(cookieValue), knownSlugs);
}

export interface ResolveActiveWorldOptions {
  /** Aktueller Pfad (`x-uwe-pathname` bzw. `usePathname()`). */
  pathname: string;
  /** Zuletzt gemerkte Welt (Cookie beim ersten Rendern, danach Shell-State). */
  rememberedSlug?: string | null;
  /** Slugs der Welten, die es wirklich gibt. */
  knownSlugs: readonly string[];
}

/**
 * Die aktive Welt: der Pfad schlägt das Gemerkte.
 *
 * Bewusst dieselbe Regel auf Server und Client. Das Root-Layout rendert bei
 * einer Client-Navigation **nicht** neu — ein serverseitig eingefrorener
 * Welt-Kontext bliebe beim Wechsel von Terra nach Aldoria auf Terra stehen.
 * Der Shell rechnet deshalb aus `usePathname()` weiter; der Server liefert nur
 * den Startwert aus dem Cookie, damit der erste Aufschlag ohne Nachrücken
 * (und ohne Hydration-Mismatch) sitzt.
 */
export function resolveActiveWorldSlug({
  pathname,
  rememberedSlug,
  knownSlugs,
}: ResolveActiveWorldOptions): string | null {
  return (
    pickKnownWorldSlug(worldSlugFromPathname(pathname), knownSlugs) ??
    pickKnownWorldSlug(rememberedSlug, knownSlugs)
  );
}

/** Client: aktive Welt merken. */
export function persistActiveWorldSlug(slug: string): void {
  if (typeof document === "undefined") return;
  if (!isWorldSlugShape(slug)) return;
  document.cookie = `${ACTIVE_WORLD_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

/** Client: Welt-Kontext verlassen. */
export function clearActiveWorldSlug(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_WORLD_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
