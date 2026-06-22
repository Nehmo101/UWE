"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultTabId?: string;
  className?: string;
  ariaLabel?: string;
}

export function Tabs({
  items,
  defaultTabId,
  className,
  ariaLabel = "Registerkarten",
}: TabsProps) {
  const fallbackId = items[0]?.id ?? "";
  const [activeId, setActiveId] = useState(defaultTabId ?? fallbackId);
  const baseId = useId();
  const active = items.find((item) => item.id === activeId) ?? items[0];

  if (!active) return null;

  return (
    <div className={cn("uwe-tabs", className)}>
      <div className="uwe-tabs-list" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const selected = item.id === active.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              className={cn("uwe-tabs-trigger", selected && "active")}
              disabled={item.disabled}
              onClick={() => setActiveId(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          className="uwe-tabs-panel"
          hidden={item.id !== active.id}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
