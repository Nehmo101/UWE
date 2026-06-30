"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile "Verify you are human" widget for UWE login forms.
 *
 * Loads the official explicit-render script once and mounts a widget. The token
 * is reported via `onToken` (null on expiry/error) and must be sent with the
 * login request, where the server verifies it. Tokens are single-use, so bump
 * `refreshSignal` after a failed login attempt to force a reset.
 *
 * The script URL mirrors `TURNSTILE_SCRIPT_URL` in `@uwe/auth/turnstile`; it is
 * inlined here to keep this client component free of server-package imports.
 */
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ELEMENT_ID = "uwe-cf-turnstile-script";

type TurnstileTheme = "auto" | "light" | "dark";

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  theme?: TurnstileTheme;
  action?: string;
  language?: string;
}

interface TurnstileApi {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  var turnstile: TurnstileApi | undefined;
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ELEMENT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile-script-error")));
      if (window.turnstile) {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ELEMENT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("turnstile-script-error")));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  /** Receives the verification token, or null when it expires / errors / resets. */
  onToken: (token: string | null) => void;
  /** Increment to force a widget reset (Turnstile tokens are single-use). */
  refreshSignal?: number;
  theme?: TurnstileTheme;
  action?: string;
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  refreshSignal = 0,
  theme = "auto",
  action,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          return;
        }
        // Guard against a double render (React strict mode mounts effects twice).
        if (widgetIdRef.current !== null) {
          return;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          action,
          callback: (token: string) => onTokenRef.current(token),
          "error-callback": () => onTokenRef.current(null),
          "expired-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) {
          onTokenRef.current(null);
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget may already be gone — ignore.
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, action]);

  useEffect(() => {
    if (refreshSignal === 0) {
      return;
    }
    if (widgetIdRef.current !== null && window.turnstile) {
      onTokenRef.current(null);
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Reset before render — ignore.
      }
    }
  }, [refreshSignal]);

  return <div ref={containerRef} className={className} data-testid="uwe-turnstile-widget" />;
}
