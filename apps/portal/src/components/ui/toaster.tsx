"use client";

import { Toaster as SonnerToaster } from "sonner";

/** Unified app toaster. Mount once in the root layout. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--uwe-panel)",
          color: "var(--uwe-fg)",
          border: "1px solid var(--uwe-border)",
        },
      }}
    />
  );
}

export { toast } from "sonner";
