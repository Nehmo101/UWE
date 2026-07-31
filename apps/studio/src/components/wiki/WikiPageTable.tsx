"use client";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AiReviewedBadge,
  CanonicalBadge,
  PageTypeBadge,
  QuestStatusBadge,
} from "@uwe/shared-ui";
import type {
  CanonicalStatus,
  PageType,
  QuestLifecycleStatus,
} from "@uwe/database/enums";
import { DataTable } from "../ui/data-table";
import { PageBatchToolbar } from "./PageBatchToolbar";

export interface WikiPageRow {
  id: string;
  title: string;
  href: string;
  type: PageType;
  canonicalStatus: CanonicalStatus;
  /** Quest lifecycle status for quest pages; `null` counts as open. */
  questStatus?: QuestLifecycleStatus | null;
  tags: string[];
  updatedAt: string;
  aiReviewedAt?: string | null;
}

const WIKI_TABLE_COLUMN_VISIBILITY_KEY = "grid gap-4 md:grid-cols-2";

const DATE_FMT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

const columns: ColumnDef<WikiPageRow>[] = [
  {
    accessorKey: "title",
    header: "Titel",
    enableHiding: false,
    // Leitspalte: trägt auf dem Telefon die Karte.
    meta: { label: "Titel", primary: true },
    cell: ({ row }) => (
      <Link href={row.original.href} className="font-medium hover:underline">
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: "type",
    header: "Typ",
    meta: { label: "Typ" },
    cell: ({ row }) =>
      row.original.type === "quest" ? (
        <span className="inline-flex flex-wrap items-center gap-1">
          <PageTypeBadge type={row.original.type} />
          <QuestStatusBadge status={row.original.questStatus ?? null} />
        </span>
      ) : (
        <PageTypeBadge type={row.original.type} />
      ),
  },
  {
    accessorKey: "tags",
    header: "Tags",
    enableSorting: false,
    // Nebensächlich auf 390 px — die Tags stehen auf der Seite selbst.
    meta: { label: "Tags", priority: "low" },
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{row.original.tags.join(", ") || "—"}</span>
    ),
  },
  {
    accessorKey: "canonicalStatus",
    header: "Kanon",
    meta: { label: "Kanon" },
    cell: ({ row }) => (
      <span className="inline-flex flex-wrap items-center gap-1">
        <CanonicalBadge status={row.original.canonicalStatus} />
        {row.original.aiReviewedAt && <AiReviewedBadge />}
      </span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Geändert",
    meta: { label: "Geändert" },
    cell: ({ row }) => (
      <time dateTime={row.original.updatedAt} className="text-xs text-muted-foreground">
        {DATE_FMT.format(new Date(row.original.updatedAt))}
      </time>
    ),
  },
];

export interface WikiPageTableProps {
  rows: WikiPageRow[];
  className?: string;
  /** Enables the multi-select batch toolbar when provided. */
  worldSlug?: string;
  campaigns?: { id: string; name: string }[];
}

export function WikiPageTable({ rows, className, worldSlug, campaigns = [] }: WikiPageTableProps) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      caption="Wiki-Seiten"
      filterPlaceholder="Seiten durchsuchen…"
      enablePagination={false}
      className={className}
      enableColumnVisibility
      columnVisibilityStorageKey={WIKI_TABLE_COLUMN_VISIBILITY_KEY}
      enableRowSelection={Boolean(worldSlug)}
      getRowId={(row) => row.id}
      renderBatchActions={
        worldSlug
          ? ({ selectedIds, clearSelection }) => (
              <PageBatchToolbar
                worldSlug={worldSlug}
                campaigns={campaigns}
                selectedIds={selectedIds}
                clearSelection={clearSelection}
              />
            )
          : undefined
      }
    />
  );
}
