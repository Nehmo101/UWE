"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Props {
  placeholder?: string;
  /** Extra hidden fields preserved on submit (e.g. list id). */
  preserveParams?: string[];
}

export function AdminListSearch({
  placeholder = "Liste durchsuchen…",
  preserveParams = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initial);

  useEffect(() => {
    setQuery(initial);
  }, [initial]);

  const applyQuery = useCallback(
    (next: string) => {
      const params = new URLSearchParams();
      for (const key of preserveParams) {
        const value = searchParams.get(key);
        if (value) params.set(key, value);
      }
      const trimmed = next.trim();
      if (trimmed) {
        params.set("q", trimmed);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, preserveParams, router, searchParams],
  );

  return (
    <form
      className="uwe-v2-form"
      style={{ marginBottom: "1rem" }}
      onSubmit={(event) => {
        event.preventDefault();
        applyQuery(query);
      }}
    >
      <label style={{ flex: 1 }}>
        Suche
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length === 0) {
              applyQuery("");
            }
          }}
        />
      </label>
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
        Filtern
      </button>
      {initial ? (
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost"
          onClick={() => {
            setQuery("");
            applyQuery("");
          }}
        >
          Zurücksetzen
        </button>
      ) : null}
    </form>
  );
}
