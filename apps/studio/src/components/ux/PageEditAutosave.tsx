"use client";

import { useEffect, useState } from "react";

interface Props {
  formId: string;
  storageKey: string;
}

/** Autosave edit form fields to localStorage (draft only — submit still required for canon). */
export function PageEditAutosave({ formId, storageKey }: Props) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return undefined;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, string>;
        for (const [name, value] of Object.entries(draft)) {
          const field = form.elements.namedItem(name);
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
            field.value = value;
          } else if (field instanceof HTMLSelectElement) {
            field.value = value;
          }
        }
        setHint("Entwurf aus lokalem Autosave wiederhergestellt.");
      }
    } catch {
      // ignore
    }

    function saveDraft() {
      const draft: Record<string, string> = {};
      const elements = form!.elements;
      for (let i = 0; i < elements.length; i += 1) {
        const el = elements.item(i);
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) {
          if (!el.name || el.type === "hidden" || el.type === "submit") continue;
          draft[el.name] = el.value;
        }
      }
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setHint("Entwurf lokal gespeichert.");
    }

    const timer = window.setInterval(saveDraft, 15_000);
    form.addEventListener("input", saveDraft);
    return () => {
      window.clearInterval(timer);
      form.removeEventListener("input", saveDraft);
    };
  }, [formId, storageKey]);

  if (!hint) return null;
  return <p className="uwe-dashboard-muted">{hint}</p>;
}
