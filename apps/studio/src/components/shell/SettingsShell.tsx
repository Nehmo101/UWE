"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "../ui/cn";

export interface SettingsTab {
  id: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface SettingsShellProps {
  title: string;
  description?: React.ReactNode;
  /** Sub-navigation. Omit when the surface has only one panel. */
  tabs?: SettingsTab[];
  children: React.ReactNode;
}

/**
 * Content-level settings layout (rendered inside the app shell):
 * a left tab list plus the active settings panel. Keeps a constant reading
 * width and stable sub-navigation. Without tabs it is a plain reading column.
 */
export function SettingsShell({ title, description, tabs, children }: SettingsShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        {tabs && tabs.length > 0 ? (
          <nav className="flex shrink-0 flex-col gap-1 md:w-56">
            {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                tab.active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              )}
            >
                {tab.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
