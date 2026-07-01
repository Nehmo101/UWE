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
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
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
