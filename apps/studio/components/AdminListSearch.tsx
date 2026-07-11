"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label } from "@/src/components/ui";

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
      className="mb-4 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        applyQuery(query);
      }}
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="admin-list-search-q">Suche</Label>
        <Input
          id="admin-list-search-q"
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
      </div>
      <Button type="submit" variant="secondary">
        Filtern
      </Button>
      {initial ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setQuery("");
            applyQuery("");
          }}
        >
          Zurücksetzen
        </Button>
      ) : null}
    </form>
  );
}
