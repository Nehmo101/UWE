"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ResolvedNavGroup } from "@uwe/shared-utils/navigation";
import { NavIcon } from "../ui/icon";
import { cn } from "../ui/cn";

/**
 * Ein Abschnitt der Seitenleiste. Der Shell rendert zwei davon: den globalen
 * Studio-Block und — solange eine Welt aktiv ist — den Welt-Block darüber.
 * Beide teilen sich denselben Aufklapp-Zustand, weil die Gruppen-Ids
 * überschneidungsfrei sind (`world-*` gegen `start`/`worlds`/`ai`/…).
 */
export interface SidebarBlock {
  id: string;
  /** Versalien-Beschriftung über den Gruppen. `null` lässt sie weg. */
  label: string | null;
  groups: ResolvedNavGroup[];
}

const SIDEBAR_GROUPS_KEY = "uwe:studio-sidebar-groups-v1";
/** Groups open on first visit regardless of the active route (small, high-traffic areas). */
const DEFAULT_OPEN_GROUP_IDS = ["start", "worlds", "world-overview", "live-core"];

/*
 * Die Gruppenköpfe trugen früher je ein eigenes Glyph (GROUP_ICONS). Bei elf
 * Gruppen und einundzwanzig Zielen ergab das zwei Icon-Spalten in derselben
 * Größe — Kopf und Ziel sahen gleich schwer aus, und die Gliederung, die der
 * Kopf eigentlich herstellen soll, verschwand in der Wiederholung. Die Icons
 * bleiben jetzt den Zielen vorbehalten; der Kopf ist eine ruhige
 * Versalien-Beschriftung mit Aufklapp-Pfeil.
 */

function readStoredGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SIDEBAR_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeStoredGroups(value: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private-mode failures
  }
}

/**
 * Collapsible, grouped sidebar navigation. Open/closed state per group persists
 * in localStorage; the group holding the active route is always expanded so the
 * current location is never hidden.
 */
export function SidebarNav({ blocks }: { blocks: SidebarBlock[] }) {
  const groups = React.useMemo(() => blocks.flatMap((block) => block.groups), [blocks]);

  const activeGroupId = React.useMemo(
    () => groups.find((group) => group.items.some((item) => item.active))?.id,
    [groups],
  );

  const computeDefaults = React.useCallback(() => {
    const stored = readStoredGroups();
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      next[group.id] =
        group.id === activeGroupId
          ? true
          : (stored[group.id] ?? DEFAULT_OPEN_GROUP_IDS.includes(group.id));
    }
    return next;
  }, [groups, activeGroupId]);

  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>(computeDefaults);

  React.useEffect(() => {
    setOpenMap(computeDefaults());
  }, [computeDefaults]);

  const setGroupOpen = React.useCallback((id: string, open: boolean) => {
    setOpenMap((current) => {
      const next = { ...current, [id]: open };
      writeStoredGroups(next);
      return next;
    });
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3 p-3">
      {blocks.map((block) => {
        const visibleGroups = block.groups.filter(
          (group) => group.items.some((item) => item.status !== "hidden"),
        );
        if (visibleGroups.length === 0) return null;
        return (
          <nav key={block.id} className="flex min-w-0 flex-col gap-1.5" aria-label={block.label ?? undefined}>
            {block.label ? (
              <p className="px-2 pb-0.5 text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)] text-sidebar-foreground/45">
                {block.label}
              </p>
            ) : null}
            {visibleGroups.map((group) => {
              const items = group.items.filter((item) => item.status !== "hidden");
              const open = openMap[group.id] ?? false;
              return (
                <SidebarNavGroup
                  key={group.id}
                  group={group}
                  items={items}
                  open={open}
                  onToggle={(event) => {
                    // Stop the click from bubbling to the mobile drawer's SheetClose.
                    event.stopPropagation();
                    setGroupOpen(group.id, !open);
                  }}
                />
              );
            })}
          </nav>
        );
      })}
    </div>
  );
}

function SidebarNavGroup({
  group,
  items,
  open,
  onToggle,
}: {
  group: ResolvedNavGroup;
  items: ResolvedNavGroup["items"];
  open: boolean;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const bodyId = `sidebar-group-${group.id}`;
  const active = items.some((item) => item.active);
  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          // Die Höhe hängt am Breakpoint, nicht an einem Kompromiss: in der
          // Schublade (unter md) bleibt der Kopf ein 44-px-Touch-Ziel, auf dem
          // Desktop ist er ein reiner Aufklapper und darf schmal sein. Elf
          // Gruppen mal 44 px waren allein 484 px Überschrift — der Grund,
          // warum die Leiste sich als endlose Versalien-Wand las.
          "flex min-h-11 w-full min-w-0 appearance-none items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1 transition-colors hover:bg-sidebar-foreground/10 md:min-h-7",
          // Der Kopf ist Gliederung, nicht Ziel: er tritt bewusst hinter die
          // Einträge zurück. Vorher trug er font-bold in voller Textfarbe und
          // wog damit schwerer als das, was er gruppiert.
          // /65 ist keine gerundete Zahl, sondern der Boden: #cfc4ab bei 65 %
          // auf rgb(33,29,23) misst 4.89:1 und hält damit AA für Fließtext.
          // Der erste Entwurf stand bei /55 — optisch schöner zurückgenommen,
          // aber nur 3.95:1 und damit durchgefallen.
          active
            ? "text-sidebar-foreground/90"
            : "text-sidebar-foreground/65 hover:text-sidebar-foreground/90",
        )}
      >
        {/*
          Der Schriftgrad sitzt am <span>, nicht am <button> — und das ist keine
          Stilfrage. `type-scale.css` setzt ungelayert `button { font-size:
          inherit }`; ungelayerte Regeln schlagen jede Tailwind-Utility aus
          `@layer utilities`, unabhängig von der Spezifität. Am Knopf verlor
          `text-[length:var(--uwe-text-2xs)]` deshalb stillschweigend, und die
          Versalien kamen mit 17 px statt 12 px heraus: bei Space Mono mit
          0.11em Sperrsatz sind das ~12 px pro Zeichen, also 209 px für
          „Knowledge & Brain" in einer 193 px breiten Spalte. Das <span> steht
          nicht in jener Elementliste und nimmt die Utility an.
        */}
        <span className="min-w-0 flex-1 truncate text-left text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)]">
          {group.title}
        </span>
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition-transform", open && "rotate-90")}
          aria-hidden
        />
      </button>
      <div
        id={bodyId}
        className={cn(
          // Die Führungslinie ersetzt den Einzug: bei elf Gruppen zeigt sie auf
          // einen Blick, wo eine Gruppe anfängt und aufhört.
          "mt-0.5 min-w-0 flex-col gap-px border-l border-sidebar-foreground/10 pb-1 pl-1.5 ml-2",
          open ? "flex" : "hidden",
        )}
      >
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              // min-h-11 = 44 px Trefferfläche in der Schublade; auf dem
              // Desktop reichen 32 px, sonst braucht die vollständige IA mehr
              // Höhe als jeder Bildschirm hat.
              "flex min-h-11 min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors md:min-h-8",
              // `no-underline` ist hier Pflicht, kein Geschmack: die Apps binden
              // Tailwind ohne Preflight ein (siehe app/globals.css), also gilt
              // für jeden <a> weiterhin die Unterstreichung des User-Agents.
              // Jedes Navigationsziel war unterstrichen. Dieselbe Falle wie bei
              // der Wortmarke oben.
              "no-underline",
              // Die Textfarbe steht hier bewusst NICHT als Utility: die
              // ungelayerte Regel `:is(.uwe-sidebar, .uwe-sidebar-surface)
              // a:not(.uwe-button-surface)` in uwe.css setzt --uwe-sidebar-fg
              // und schlägt jede Tailwind-Klasse aus @layer utilities. Ein
              // `text-sidebar-foreground/85` hier wäre toter Code, der eine
              // Abstufung vortäuscht, die im Browser nie ankommt (gemessen:
              // beide Zustände rgb(207,196,171), 9.7:1).
              //
              // Der aktive Zustand trägt deshalb Fläche, Gewicht und
              // Akzent-Icon statt einer Textfarbe — alle drei greifen.
              item.active
                ? "bg-primary/15 font-medium"
                : "hover:bg-sidebar-foreground/10",
              item.status === "planned" && "opacity-60",
            )}
          >
            <NavIcon
              name={item.icon}
              width={16}
              height={16}
              className={cn(
                "shrink-0",
                item.active ? "text-primary" : "text-sidebar-foreground/60",
              )}
            />
            <span className="min-w-0 truncate">{item.label}</span>
            {item.status === "planned" ? (
              <span className="ml-auto shrink-0 text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)] text-sidebar-foreground/70">
                bald
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
