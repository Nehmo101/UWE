"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { NavItem } from "@uwe/shared-utils/navigation";
import type { NavAudit, NavAuditEntry } from "../../navigation/inspect-navigation";
import { readHiddenNavIds, toggleHiddenNavId } from "../../lib/nav-visibility-prefs";
import { DataTable } from "../ui/data-table";
import { NavIcon } from "../ui/icon";
import { Alert, EmptyState } from "../ui/states";

export interface NavigationOverviewProps {
  items: NavItem[];
  audit: NavAudit;
}

const STATUS_LABEL: Record<NavItem["status"], string> = {
  active: "Aktiv",
  planned: "Geplant",
  "legacy-ui-disconnected": "Legacy (abgekoppelt)",
  hidden: "Versteckt",
};

function buildColumns(
  hiddenIds: Set<string>,
  onToggle: (id: string, hidden: boolean) => void,
): ColumnDef<NavItem>[] {
  return [
  {
    accessorKey: "icon",
    header: "",
    enableSorting: false,
    cell: ({ row }) => <NavIcon name={row.original.icon} width={16} height={16} />,
  },
  { accessorKey: "section", header: "Bereich" },
  { accessorKey: "group", header: "Gruppe" },
  { accessorKey: "label", header: "Label" },
  {
    accessorKey: "href",
    header: "Route",
    cell: ({ row }) => <code className="text-xs">{row.original.href}</code>,
  },
  {
    id: "permission",
    header: "Rolle",
    accessorFn: (row) => row.permission.join(", "),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => STATUS_LABEL[row.original.status],
  },
  {
    id: "sidebar",
    header: "Sidebar",
    enableSorting: false,
    cell: ({ row }) => {
      const hidden = hiddenIds.has(row.original.id);
      return (
        <label className="inline-flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={!hidden}
            onChange={(event) => onToggle(row.original.id, !event.target.checked)}
          />
          {hidden ? "Ausgeblendet" : "Sichtbar"}
        </label>
      );
    },
  },
  { accessorKey: "source", header: "Quelle" },
  ];
}

export function NavigationOverview({ items, audit }: NavigationOverviewProps) {
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setHiddenIds(readHiddenNavIds());
    const onChange = () => setHiddenIds(readHiddenNavIds());
    window.addEventListener("uwe:nav-visibility-changed", onChange);
    return () => window.removeEventListener("uwe:nav-visibility-changed", onChange);
  }, []);

  const handleToggle = React.useCallback((id: string, hidden: boolean) => {
    setHiddenIds(toggleHiddenNavId(id, hidden));
  }, []);

  const columns = React.useMemo(() => buildColumns(hiddenIds, handleToggle), [hiddenIds, handleToggle]);
  const visibleCount = items.filter((item) => !hiddenIds.has(item.id)).length;
  const hasWarnings =
    audit.deadLinks.length > 0 ||
    audit.promotable.length > 0 ||
    audit.conflicts.duplicateIds.length > 0 ||
    audit.conflicts.duplicateHrefs.length > 0 ||
    audit.conflicts.duplicateLabels.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Navigation</h1>
        <p className="text-sm text-muted-foreground">
          Zentrale Navigation als Quelle für Sidebar, Mobile-Nav, Breadcrumbs und Command-Palette.
          Warnungen zeigen tote Links, geplante Routen, fehlende Nav-Einträge und Duplikate.
          Ausgeblendete Einträge werden in der Sidebar ausgeblendet (lokal im Browser gespeichert).
        </p>
        <p className="text-sm text-muted-foreground">
          Live-Vorschau: <strong>{visibleCount}</strong> von {items.length} Einträgen sichtbar in der
          Sidebar.
        </p>
      </header>

      {!hasWarnings ? (
        <Alert tone="success" icon="shield-check" title="Keine Navigationsprobleme">
          Alle aktiven Einträge zeigen auf existierende Routen, keine Duplikate.
        </Alert>
      ) : null}

      {audit.deadLinks.length > 0 ? (
        <WarningList tone="danger" icon="shield" title="Tote Links (aktive Route fehlt)" entries={audit.deadLinks} />
      ) : null}
      {audit.promotable.length > 0 ? (
        <WarningList
          tone="info"
          icon="sparkles"
          title="Geplant, Route existiert bereits (kann aktiviert werden)"
          entries={audit.promotable}
        />
      ) : null}
      {audit.conflicts.duplicateIds.length > 0 ? (
        <Alert tone="warning" icon="list-tree" title="Doppelte IDs">
          {audit.conflicts.duplicateIds.join(", ")}
        </Alert>
      ) : null}
      {audit.conflicts.duplicateHrefs.length > 0 ? (
        <Alert tone="warning" icon="list-tree" title="Doppelte Routen">
          {audit.conflicts.duplicateHrefs.join(", ")}
        </Alert>
      ) : null}
      {audit.conflicts.duplicateLabels.length > 0 ? (
        <Alert tone="warning" icon="list-tree" title="Doppelte Labels">
          {audit.conflicts.duplicateLabels.join(", ")}
        </Alert>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Alle Einträge ({items.length})
        </h2>
        {items.length === 0 ? (
          <EmptyState title="Keine Navigationseinträge" />
        ) : (
          <DataTable columns={columns} data={items} filterPlaceholder="Navigation filtern…" />
        )}
      </section>

      {audit.routesWithoutNav.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Routen ohne Navigationseintrag ({audit.routesWithoutNav.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {audit.routesWithoutNav.map((route) => (
              <code key={route} className="rounded border border-border px-2 py-1 text-xs">
                {route}
              </code>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function WarningList({
  tone,
  icon,
  title,
  entries,
}: {
  tone: "danger" | "info";
  icon: string;
  title: string;
  entries: NavAuditEntry[];
}) {
  return (
    <Alert tone={tone} icon={icon} title={title}>
      <ul className="mt-1 flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="font-medium">{entry.label}</span> — <code className="text-xs">{entry.href}</code>{" "}
            <span className="text-xs">({entry.section})</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
