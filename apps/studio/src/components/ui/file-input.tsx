import * as React from "react";
import { cn } from "./cn";

export type FileInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Design-Kit-File-Input: gestyltes natives input[type=file]. Native Props wie
 * `accept` und `multiple` laufen unverändert durch; controlled value gibt es
 * bei File-Inputs naturgemäß nicht (Auswahl via onChange lesen).
 */
export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="file"
      className={cn(
        "flex w-full cursor-pointer rounded-[var(--radius)] border border-input bg-transparent text-sm text-foreground shadow-sm transition-colors file:mr-3 file:cursor-pointer file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
FileInput.displayName = "FileInput";
