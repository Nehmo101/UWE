"use client";

import { createContext, useContext, type ReactNode } from "react";
import { readClientAppUrls, type ClientAppUrls } from "./clientAppUrls";

/**
 * Produkt-Origins für die app-übergreifende Navigation, zur Laufzeit vom Server
 * gereicht.
 *
 * Warum nicht einfach {@link readClientAppUrls}: Next ersetzt
 * `process.env.NEXT_PUBLIC_*` beim **Build**. Eine Adresse, die der Betreiber
 * danach setzt — im Host-Env-Editor der Kommandozentrale oder abgeleitet aus
 * dem Split-Hostname-Layout (`resolveFamilyPublicBaseUrl`) — erreicht ein
 * fertig gebautes Client-Bundle nie. Genau daher kam der Family-Link, der auf
 * `http://localhost:3004` zeigte, obwohl die App unter `family.<apex>` lief.
 *
 * Das Layout der jeweiligen App löst die Origins pro Anfrage auf und stellt sie
 * hier bereit. Ohne Provider bleibt es beim Build-Zeit-Wert — bestehende
 * Aufrufer verhalten sich also unverändert.
 */
const AppUrlsContext = createContext<ClientAppUrls | null>(null);

export function AppUrlsProvider({
  value,
  children,
}: {
  value: ClientAppUrls;
  children: ReactNode;
}) {
  return <AppUrlsContext.Provider value={value}>{children}</AppUrlsContext.Provider>;
}

/** Server-aufgelöste Origins, sonst der Build-Zeit-Stand aus der Umgebung. */
export function useClientAppUrls(): ClientAppUrls {
  return useContext(AppUrlsContext) ?? readClientAppUrls();
}
