/**
 * Produkt-Origins für Client-Komponenten (die app-übergreifende Bottom-Nav).
 *
 * Warum nicht `readPublicAppUrls`/`resolveUweAppUrls`: die lesen `process.env`
 * als Objekt. Next inlined im Client-Bundle aber nur **literale** Zugriffe der
 * Form `process.env.NEXT_PUBLIC_X` — ein dynamischer Property-Zugriff bliebe
 * leer. Deshalb stehen die drei Namen hier ausgeschrieben.
 *
 * Die Fallbacks sind die Dev-Ports aus AGENTS.md; in Produktion setzt das
 * Deployment die NEXT_PUBLIC_*-Werte (Build-Zeit).
 */

export interface ClientAppUrls {
  /** Apex/Landing — dieselbe Herkunft wie Studio, sofern nicht getrennt. */
  start: string;
  studio: string;
  portal: string;
  brain: string;
}

export function readClientAppUrls(): ClientAppUrls {
  const studio = process.env.NEXT_PUBLIC_STUDIO_URL || "http://localhost:3000";
  return {
    start: studio,
    studio,
    portal: process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3001",
    brain: process.env.NEXT_PUBLIC_BRAIN_URL || "http://localhost:3002",
  };
}
