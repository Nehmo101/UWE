"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "./cn";

/**
 * Radix Select verbietet `value=""` auf Items ("A <Select.Item /> must have a
 * value prop that is not an empty string"). SELECT_EMPTY_VALUE ist der
 * Sentinel dafür: `Select` und `SelectItem` übersetzen "" ↔ Sentinel, sodass
 * Aufrufer weiter mit "" als Leerwert arbeiten können (z. B. „— keine —“ /
 * „Alle“). ACHTUNG: In FormData-Formularen (Select mit `name`) submittet das
 * versteckte native Select den Sentinel-Rohwert — dort den Leerwert weiterhin
 * nativ lösen oder serverseitig SELECT_EMPTY_VALUE normalisieren.
 */
export const SELECT_EMPTY_VALUE = "__empty__";

function toRadixValue(value: string | undefined): string | undefined {
  return value === "" ? SELECT_EMPTY_VALUE : value;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>) {
  return (
    <SelectPrimitive.Root
      value={toRadixValue(value)}
      defaultValue={toRadixValue(defaultValue)}
      onValueChange={
        onValueChange
          ? (next) => onValueChange(next === SELECT_EMPTY_VALUE ? "" : next)
          : undefined
      }
      {...props}
    />
  );
}

export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 opacity-60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-50 min-w-32 overflow-hidden rounded-[var(--radius)] border border-border bg-popover text-popover-foreground shadow-md",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, value, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    value={value === "" ? SELECT_EMPTY_VALUE : value}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-muted",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
