"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "pointerdown"] as const;
const TOUCH_DEBOUNCE_MS = 30_000;

interface SessionIdleGuardProps {
  /** Inactivity timeout in milliseconds. 0 = disabled. */
  timeoutMs: number;
  logoutRedirect?: string;
}

export function SessionIdleGuard({
  timeoutMs,
  logoutRedirect = "/login?reason=idle",
}: SessionIdleGuardProps) {
  const router = useRouter();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (timeoutMs <= 0) {
      return;
    }

    async function logoutForInactivity() {
      if (loggingOutRef.current) {
        return;
      }
      loggingOutRef.current = true;
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Best effort — redirect even if network fails.
      }
      router.push(logoutRedirect);
      router.refresh();
    }

    function resetIdleTimer() {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        void logoutForInactivity();
      }, timeoutMs);
    }

    function scheduleTouch() {
      if (touchTimerRef.current) {
        return;
      }
      touchTimerRef.current = setTimeout(() => {
        touchTimerRef.current = null;
        void fetch("/api/auth/session/touch", { method: "POST" }).catch(() => undefined);
      }, TOUCH_DEBOUNCE_MS);
    }

    function onActivity() {
      resetIdleTimer();
      scheduleTouch();
    }

    resetIdleTimer();

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onActivity);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
      }
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
      document.removeEventListener("visibilitychange", onActivity);
    };
  }, [logoutRedirect, router, timeoutMs]);

  return null;
}
