"use client";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { CanonicalBadge, PageTypeBadge, PublishBadge, VisibilityBadge } from "@uwe/shared-ui";
import type { CanonicalStatus, PageType, PublishStatus, Visibility } from "@uwe/database/enums";
import { DataTable } from "../ui/data-table";

export interface WikiPageRow {
  id: string;
  title: string;
  href: string;
  type: PageType;
  visibility: Visibility;
  publishStatus: PublishStatus;
  canonicalStatus: CanonicalStatus;
  tags: string[];
  updatedAt: string;
}

const WIKI_TABLE_COLUMN_VISIBILITY_KEY = "uwe-wiki-page-table-columns";

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
    cell: ({ row }) => <PageTypeBadge type={row.original.type} />,
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
    cell: ({ row }) => <PublishBadge status={row.original.publishStatus} />,
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

export function WikiPageTable({ rows, className }: { rows: WikiPageRow[]; className?: string }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      filterPlaceholder="Seiten durchsuchen…"
      pageSize={25}
      className={className}
      enableColumnVisibility
      columnVisibilityStorageKey={WIKI_TABLE_COLUMN_VISIBILITY_KEY}
    />
  );
}
