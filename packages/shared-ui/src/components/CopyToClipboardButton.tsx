"use client";

import { useCallback, useState } from "react";
import { Button, type ButtonProps } from "./Button";

export interface CopyToClipboardButtonProps extends Omit<ButtonProps, "onClick"> {
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
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || !text}
      onClick={() => void handleCopy()}
      {...props}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
