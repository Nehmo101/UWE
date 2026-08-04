import * as React from "react";
import { cn } from "./cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /**
   * Optionaler Beschriftungstext neben der Box. Wenn gesetzt, werden Input und
   * Text in ein <label> gewickelt — Klick auf den Text toggelt die Checkbox
   * ohne htmlFor/id-Verdrahtung. Ohne `label` wird nur der nackte Input
   * gerendert (dann selbst beschriften, z. B. via <Label htmlFor=…>).
   */
  label?: React.ReactNode;
  /** Zusatzklassen für das umschließende <label>; nur zusammen mit `label` wirksam. */
  labelClassName?: string;
}

/**
 * Design-Kit-Checkbox: gestyltes natives input[type=checkbox]. Funktioniert
 * controlled (checked/onChange), uncontrolled (defaultChecked) und in
 * FormData-Formularen (name/value), ohne Zusatz-Wiring.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, labelClassName, ...props }, ref) => {
    const box = (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "size-4 shrink-0 rounded border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
    if (label == null) return box;
    return (
      <label className={cn("flex items-center gap-2 text-sm text-foreground", labelClassName)}>
        {box}
        <span>{label}</span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
