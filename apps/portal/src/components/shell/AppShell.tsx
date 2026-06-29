"use client";

import * as React from "react";
import Link from "next/link";
import type { NavCommand, ResolvedNavGroup } from "@uwe/shared-utils/navigation";
import { NavIcon } from "../ui/icon";
import { CommandPalette } from "../ui/command-palette";
import { Sheet, SheetContent, SheetClose, SheetTrigger } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../ui/cn";

export interface AppShellProps {
  /** Resolved navigation groups (with active flags) for the sidebar. */
  groups: ResolvedNavGroup[];
  /** Command palette entries (Cmd/Ctrl+K). */
  commands?: NavCommand[];
  brandLabel: string;
  brandHref?: string;
  breadcrumb?: React.ReactNode;
  contextPanel?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Central application shell: stable left sidebar + top bar (breadcrumb + global
 * command) + main content + optional right context panel, with a mobile drawer
 * fed from the same navigation source. Every product shell composes this.
 */
export function AppShell({
  groups,
  commands = [],
  brandLabel,
  brandHref = "/",
  breadcrumb,
  contextPanel,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBrand label={brandLabel} href={brandHref} />
        <ScrollArea className="flex-1">
          <SidebarNav groups={groups} />
        </ScrollArea>
        {footer ? <div className="border-t border-border p-3 text-xs text-muted-foreground">{footer}</div> : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4">
          <MobileNav groups={groups} brandLabel={brandLabel} />
          <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{breadcrumb}</div>
          {commands.length > 0 ? <CommandHint /> : null}
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
          {contextPanel ? (
            <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border p-4 lg:block">
              {contextPanel}
            </aside>
          ) : null}
        </div>
      </div>

      {commands.length > 0 ? <CommandPalette commands={commands} /> : null}
    </div>
  );
}

function SidebarBrand({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex h-14 items-center gap-2 border-b border-border px-4 font-semibold"
    >
      {label}
    </Link>
  );
}

function SidebarNav({ groups }: { groups: ResolvedNavGroup[] }) {
  return (
    <nav className="flex flex-col gap-4 p-3">
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <div className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.title}
          </div>
          {group.items
            .filter((item) => item.status !== "hidden")
            .map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  item.active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-muted",
                  item.status === "planned" && "opacity-60",
                )}
              >
                <NavIcon name={item.icon} width={16} height={16} />
                <span className="truncate">{item.label}</span>
                {item.status === "planned" ? (
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">bald</span>
                ) : null}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  );
}

function MobileNav({ groups, brandLabel }: { groups: ResolvedNavGroup[]; brandLabel: string }) {
  return (
    <Sheet>
      <SheetTrigger
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden"
        aria-label="Navigation öffnen"
      >
        <NavIcon name="menu" width={18} height={18} />
      </SheetTrigger>
      <SheetContent side="left" title={brandLabel}>
        <div className="mb-2 px-2 font-semibold">{brandLabel}</div>
        <ScrollArea className="flex-1">
          <SheetClose asChild>
            <div>
              <SidebarNav groups={groups} />
            </div>
          </SheetClose>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function CommandHint() {
  return (
    <kbd className="hidden items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
      <span>⌘</span>K
    </kbd>
  );
}
