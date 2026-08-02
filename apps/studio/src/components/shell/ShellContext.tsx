"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { persistWorldLastRoute } from "@/src/lib/world-last-route";
import {
  clearActiveWorldSlug,
  persistActiveWorldSlug,
  pickKnownWorldSlug,
  resolveActiveWorldSlug,
  worldSlugFromPathname,
} from "@/src/lib/active-world";

export interface ShellWorld {
  slug: string;
  name: string;
}

interface ShellWorldValue {
  /** Alle Welten — Datenquelle des Welt-Switchers. */
  worlds: ShellWorld[];
  /** Die Welt, deren Block in der Seitenleiste steht (oder `null`). */
  activeWorld: ShellWorld | null;
  /** Steht die Route selbst in der Welt, oder ist sie nur gemerkt? */
  inWorldRoute: boolean;
  /** Welt-Kontext verlassen: Block zu, Cookie weg. */
  leaveWorld: () => void;
}

const ShellWorldContext = React.createContext<ShellWorldValue | null>(null);

/** Welt-Kontext des Shells. Nur innerhalb von `ShellProvider` gültig. */
export function useShellWorld(): ShellWorldValue {
  const value = React.useContext(ShellWorldContext);
  if (!value) {
    throw new Error("useShellWorld muss innerhalb von <ShellProvider> stehen.");
  }
  return value;
}

interface ShellSlotValue {
  breadcrumb: BreadcrumbItem[] | null;
  contextPanel: React.ReactNode | null;
}

interface ShellSlotWriters {
  setBreadcrumb: (items: BreadcrumbItem[] | null) => void;
  setContextPanel: (node: React.ReactNode | null) => void;
}

const ShellSlotValueContext = React.createContext<ShellSlotValue>({
  breadcrumb: null,
  contextPanel: null,
});

/*
 * Schreiber und Werte hängen an getrennten Contexts. Sonst rendert jede Seite,
 * die nur *füllt*, bei jeder Änderung eines fremden Slots mit — und weil die
 * Füller im Seitenbaum unter `<main>` sitzen, wäre das der gesamte Inhalt.
 * Die Setter aus `useState` sind stabil, dieser Context ändert sich also nie.
 */
const ShellSlotWriteContext = React.createContext<ShellSlotWriters | null>(null);

export function useShellSlots(): ShellSlotValue {
  return React.useContext(ShellSlotValueContext);
}

function useShellSlotWriters(): ShellSlotWriters | null {
  return React.useContext(ShellSlotWriteContext);
}

export interface ShellProviderProps {
  worlds: ShellWorld[];
  /**
   * Startwert aus dem `uwe_active_world`-Cookie, serverseitig gegen die
   * Weltliste geprüft. Danach führt der Client den Zustand weiter.
   */
  initialWorldSlug: string | null;
  children: React.ReactNode;
}

export function ShellProvider({ worlds, initialWorldSlug, children }: ShellProviderProps) {
  const pathname = usePathname() ?? "/";
  const knownSlugs = React.useMemo(() => worlds.map((world) => world.slug), [worlds]);
  const [rememberedSlug, setRememberedSlug] = React.useState<string | null>(initialWorldSlug);

  const routeSlug = pickKnownWorldSlug(worldSlugFromPathname(pathname), knownSlugs);

  /*
   * Zustandsabgleich während des Renderns, nicht im Effekt: React verwirft den
   * angefangenen Durchlauf und rechnet sofort neu, es kommt also nie ein Bild
   * mit der alten Welt auf den Schirm. Ein `useEffect` hier hieße: einmal mit
   * der vorigen Welt rendern, committen, dann korrigieren — genau das Flackern,
   * das der Cookie verhindern soll.
   */
  if (routeSlug && routeSlug !== rememberedSlug) {
    setRememberedSlug(routeSlug);
  }

  const activeSlug = resolveActiveWorldSlug({ pathname, rememberedSlug, knownSlugs });
  const inWorldRoute = routeSlug !== null;

  React.useEffect(() => {
    if (!routeSlug) return;
    persistActiveWorldSlug(routeSlug);
    // Die Unterrouten-Erinnerung je Welt lag früher im WorldShell. Sie gehört
    // zum Welt-Kontext, nicht zu einem Shell-Rahmen, und zieht deshalb mit um.
    persistWorldLastRoute(routeSlug, pathname);
  }, [pathname, routeSlug]);

  const leaveWorld = React.useCallback(() => {
    setRememberedSlug(null);
    clearActiveWorldSlug();
  }, []);

  const worldValue = React.useMemo<ShellWorldValue>(() => {
    const activeWorld = activeSlug
      ? (worlds.find((world) => world.slug === activeSlug) ?? null)
      : null;
    return { worlds, activeWorld, inWorldRoute, leaveWorld };
  }, [activeSlug, inWorldRoute, leaveWorld, worlds]);

  const [breadcrumb, setBreadcrumb] = React.useState<BreadcrumbItem[] | null>(null);
  const [contextPanel, setContextPanel] = React.useState<React.ReactNode | null>(null);

  const writers = React.useMemo<ShellSlotWriters>(
    () => ({ setBreadcrumb, setContextPanel }),
    [],
  );
  const slotValue = React.useMemo<ShellSlotValue>(
    () => ({ breadcrumb, contextPanel }),
    [breadcrumb, contextPanel],
  );

  return (
    <ShellWorldContext.Provider value={worldValue}>
      <ShellSlotWriteContext.Provider value={writers}>
        <ShellSlotValueContext.Provider value={slotValue}>
          {children}
        </ShellSlotValueContext.Provider>
      </ShellSlotWriteContext.Provider>
    </ShellWorldContext.Provider>
  );
}

/**
 * Brotkrumen einer Seite an die Topbar melden.
 *
 * Rendert selbst nichts. Ohne diese Meldung leitet der Shell die Spur aus dem
 * Navigationsvertrag ab — das genügt für Listen- und Bereichsseiten. Nur
 * Detailseiten, deren letztes Segment ein Datensatz-Titel ist, melden hier
 * ihre vollständige Spur nach.
 */
export function ShellBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const writers = useShellSlotWriters();
  const setBreadcrumb = writers?.setBreadcrumb;
  // `items` ist bei jedem Rendern ein neues Array; die serialisierte Form
  // hält den Effekt still, solange sich der Inhalt nicht ändert.
  const serialized = JSON.stringify(items);

  React.useEffect(() => {
    if (!setBreadcrumb) return;
    setBreadcrumb(JSON.parse(serialized) as BreadcrumbItem[]);
    return () => setBreadcrumb(null);
  }, [serialized, setBreadcrumb]);

  return null;
}

/**
 * Rechte Kontextspalte einer Seite füllen (ab `lg` sichtbar).
 *
 * Ebenfalls ein reiner Melder: die Kinder werden nicht hier gerendert, sondern
 * im `<aside>` des Shells. Eine Seite meldet höchstens einen Kontextbereich —
 * bei mehreren gewinnt der zuletzt gemountete.
 */
export function ShellContextPanel({ children }: { children: React.ReactNode }) {
  const writers = useShellSlotWriters();
  const setContextPanel = writers?.setContextPanel;

  React.useEffect(() => {
    if (!setContextPanel) return;
    setContextPanel(children);
    return () => setContextPanel(null);
  }, [children, setContextPanel]);

  return null;
}
