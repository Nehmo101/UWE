"use client";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AiReviewedBadge,
  CanonicalBadge,
  PageTypeBadge,
  PublishBadge,
  QuestStatusBadge,
  VisibilityBadge,
} from "@uwe/shared-ui";
import type {
  CanonicalStatus,
  PageType,
  PublishStatus,
  QuestLifecycleStatus,
  Visibility,
} from "@uwe/database/enums";
import { DataTable } from "../ui/data-table";
import { PageBatchToolbar } from "./PageBatchToolbar";

export interface WikiPageRow {
  id: string;
  title: string;
  href: string;
  type: PageType;
  visibility: Visibility;
  publishStatus: PublishStatus;
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
    meta: { label: "Titel" },
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
    meta: { label: "Tags" },
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{row.original.tags.join(", ") || "—"}</span>
    ),
  },
  {
    accessorKey: "visibility",
    header: "Sichtbarkeit",
    meta: { label: "Sichtbarkeit" },
    cell: ({ row }) => <VisibilityBadge visibility={row.original.visibility} />,
  },
  {
    accessorKey: "publishStatus",
    header: "Status",
    meta: { label: "Status" },
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-1">
        <PublishBadge status={row.original.publishStatus} />
        {row.original.aiReviewedAt ? <AiReviewedBadge /> : null}
      </div>
    ),
  },
  {
    accessorKey: "canonicalStatus",
    header: "Kanon",
    meta: { label: "Kanon" },
    cell: ({ row }) => <CanonicalBadge status={row.original.canonicalStatus} />,
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
