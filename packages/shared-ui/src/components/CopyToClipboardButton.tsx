"use client";

import { useCallback, useState, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type CopyToClipboardButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle";

export type CopyToClipboardButtonSize = "default" | "sm" | "small";

const BASE_CLASS =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const VARIANT_CLASS: Record<CopyToClipboardButtonVariant, string> = {
  default: "border border-input bg-transparent text-foreground hover:bg-muted",
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  subtle: "border border-input bg-transparent text-foreground hover:bg-muted",
};

const SIZE_CLASS: Record<CopyToClipboardButtonSize, string> = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 px-3 text-xs",
  small: "h-8 px-3 text-xs",
};

export interface CopyToClipboardButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: CopyToClipboardButtonVariant;
  size?: CopyToClipboardButtonSize;
  text: string;
  /** Shown briefly after a successful copy. */
  copiedLabel?: string;
  label?: string;
}

export function CopyToClipboardButton({
  text,
  copiedLabel = "Kopiert",
  label = "Kopieren",
  variant = "secondary",
  size = "sm",
  disabled,
  className,
  ...props
}: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <button
      type="button"
      className={cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      disabled={disabled || !text}
      onClick={() => void handleCopy()}
      {...props}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
