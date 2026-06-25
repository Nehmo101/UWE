"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Matches CommandPalette focusable query. */
export const FOCUSABLE_SELECTOR =
  'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.tabIndex !== -1,
  );
}

function collectFocusables(
  container: HTMLElement,
  extra: HTMLElement | null | undefined,
): HTMLElement[] {
  const inContainer = getFocusableElements(container);
  if (extra && extra.tabIndex >= 0 && !inContainer.includes(extra)) {
    return [extra, ...inContainer];
  }
  return inContainer;
}

export interface UseFocusTrapOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** Included in tab cycle (e.g. backdrop close button). */
  extraFocusablesRef?: RefObject<HTMLElement | null>;
  /** Focus target when trap activates; defaults to first focusable in container. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Fallback when no suitable opener is focused at activation time. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
}

/**
 * Traps Tab within a container while active and restores focus on deactivate.
 * Tab cycling matches {@link CommandPalette}.
 */
export function useFocusTrap({
  active,
  containerRef,
  extraFocusablesRef,
  initialFocusRef,
  returnFocusRef,
  onEscape,
}: UseFocusTrapOptions): void {
  const returnFocusSnapshot = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    const opener =
      document.activeElement instanceof HTMLElement &&
      container &&
      !container.contains(document.activeElement) &&
      !extraFocusablesRef?.current?.contains(document.activeElement)
        ? document.activeElement
        : null;

    returnFocusSnapshot.current = opener ?? returnFocusRef?.current ?? null;

    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      const first = container ? getFocusableElements(container)[0] : undefined;
      first?.focus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscape?.();
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;

      const focusable = collectFocusables(
        containerRef.current,
        extraFocusablesRef?.current,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusSnapshot.current?.focus();
    };
  }, [
    active,
    containerRef,
    extraFocusablesRef,
    initialFocusRef,
    returnFocusRef,
    onEscape,
  ]);
}
