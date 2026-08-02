"use client";

import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "./cn";

export interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /** Sidebar variant: always-visible scrollbar styled for dark nav panels. */
  variant?: "default" | "sidebar";
}

export const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, variant = "default", type, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    type={type ?? (variant === "sidebar" ? "always" : undefined)}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    {/*
      Radix legt in den Viewport einen eigenen Wrapper mit
      `style="min-width:100%;display:table"`. `display: table` ist eine
      Shrink-to-fit-Fläche: der Inhalt wird nach seiner *max-content*-Breite
      bemessen, nicht nach der des Viewports. In der Seitenleiste wuchs der
      Navigationsbaum damit auf 298 px in einer 255 px breiten Fläche — die
      Aufklapp-Pfeile standen 43 px außerhalb und waren unsichtbar, die
      längsten Gruppentitel („Knowledge & Brain") liefen über die Kante.
      `truncate` half nicht: es gab schlicht keine Begrenzung, an der es
      hätte greifen können.

      `block` stellt die normale Breitenvererbung wieder her. Das `!` ist
      nötig, weil Radix per Inline-Style setzt — nur eine !important-Regel
      des Autors schlägt die. Horizontales Scrollen verliert der ScrollArea
      damit; in Studio wie in Portal wird er ausschließlich vertikal
      benutzt (Seitenleiste und Schublade, sonst nirgends).

      Diese Datei steht unter dem Sync-Guard aus
      `scripts/ui-primitive-sync.test.ts`: Studio- und Portal-Kopie müssen
      byteweise gleich bleiben. Änderungen also immer in beiden.
    */}
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:block!">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar
      orientation="vertical"
      className={cn(
        "flex touch-none select-none transition-colors",
        variant === "sidebar" ? "w-3 p-0.5" : "p-0.5",
      )}
    >
      <ScrollAreaPrimitive.Thumb
        className={cn(
          "relative flex-1 rounded-full",
          variant === "sidebar"
            ? "bg-sidebar-foreground/45 hover:bg-sidebar-foreground/65"
            : "bg-border",
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = "ScrollArea";
