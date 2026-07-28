"use client";

import * as React from "react";

interface MailKeyboardHandlers {
  /** Whether shortcuts are active (disabled while a modal/panel is open). */
  enabled: boolean;
  messageIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReply: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onStar: () => void;
  onFocusSearch: () => void;
}

/**
 * Gmail-style keyboard navigation for the Mail Center. Ignores keystrokes while
 * an input/textarea/contenteditable is focused so typing in search/compose is
 * never hijacked. j/k move the selection, Enter opens, e archive, # trash,
 * r reply, s star, / focus search.
 */
export function useMailKeyboard(handlers: MailKeyboardHandlers): void {
  const ref = React.useRef(handlers);
  ref.current = handlers;

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const h = ref.current;
      if (!h.enabled) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      const ids = h.messageIds;
      const index = h.selectedId ? ids.indexOf(h.selectedId) : -1;

      switch (event.key) {
        case "j": {
          if (ids.length === 0) return;
          const next = index < 0 ? 0 : Math.min(index + 1, ids.length - 1);
          h.onSelect(ids[next]);
          event.preventDefault();
          break;
        }
        case "k": {
          if (ids.length === 0) return;
          const prev = index < 0 ? 0 : Math.max(index - 1, 0);
          h.onSelect(ids[prev]);
          event.preventDefault();
          break;
        }
        case "e":
          if (h.selectedId) {
            h.onArchive();
            event.preventDefault();
          }
          break;
        case "#":
          if (h.selectedId) {
            h.onTrash();
            event.preventDefault();
          }
          break;
        case "r":
          if (h.selectedId) {
            h.onReply();
            event.preventDefault();
          }
          break;
        case "s":
          if (h.selectedId) {
            h.onStar();
            event.preventDefault();
          }
          break;
        case "/":
          h.onFocusSearch();
          event.preventDefault();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
