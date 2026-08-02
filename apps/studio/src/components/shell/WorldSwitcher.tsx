"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Globe, LogOut, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/cn";
import { useShellWorld } from "./ShellContext";

/**
 * Welt-Switcher im Kopf der Seitenleiste.
 *
 * Vor der Zusammenführung war der Weltwechsel ein Shell-Wechsel: zurück auf
 * `/worlds`, Karte anklicken, andere Seitenleiste. Hier ist er ein Menü —
 * die Shell bleibt stehen, nur der Welt-Block darunter tauscht.
 *
 * Das Ziel ist bewusst `/worlds/<slug>` und nicht das Dashboard: dort sitzt
 * der Redirect, der die zuletzt besuchte Unterroute dieser Welt kennt
 * (`uwe_world_route_<slug>`). Wer die Welt beim Soundboard verlassen hat,
 * kommt beim Soundboard wieder an.
 */
export function WorldSwitcher() {
  const { worlds, activeWorld, leaveWorld } = useShellWorld();
  const router = useRouter();

  const handleLeave = React.useCallback(() => {
    leaveWorld();
    router.push("/worlds");
  }, [leaveWorld, router]);

  return (
    <div className="px-3 pb-1 pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            // 44 px Trefferfläche — der Switcher ist auf dem Telefon in der
            // Schublade das erste Bedienelement.
            "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-border/70 bg-sidebar-foreground/5 px-2.5 text-left",
            "transition-colors hover:bg-sidebar-foreground/10",
          )}
          aria-label={activeWorld ? `Welt wechseln — aktuell ${activeWorld.name}` : "Welt wählen"}
        >
          <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[length:var(--uwe-text-2xs)] font-semibold uppercase tracking-[var(--uwe-tracking-caps)] text-sidebar-foreground/65">
              Welt
            </span>
            <span className="min-w-0 truncate text-sm font-medium">
              {activeWorld ? activeWorld.name : "Welt wählen"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Welt wechseln</DropdownMenuLabel>
          {worlds.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Noch keine Welten angelegt.</p>
          ) : (
            worlds.map((world) => (
              <DropdownMenuItem key={world.slug} asChild>
                <Link href={`/worlds/${world.slug}`} className="no-underline">
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      world.slug === activeWorld?.slug ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{world.name}</span>
                </Link>
              </DropdownMenuItem>
            ))
          )}

          <DropdownMenuSeparator className="my-1 h-px bg-border" />

          <DropdownMenuItem asChild>
            <Link href="/worlds" className="no-underline">
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              <span>Alle Welten / neue Welt</span>
            </Link>
          </DropdownMenuItem>

          {activeWorld ? (
            <DropdownMenuItem onSelect={handleLeave}>
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              <span>Welt verlassen</span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
