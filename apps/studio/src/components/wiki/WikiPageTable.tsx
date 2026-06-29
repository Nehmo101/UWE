"use client";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { PageTypeBadge, PublishBadge, VisibilityBadge } from "@uwe/shared-ui";
import type { PageType, PublishStatus, Visibility } from "@uwe/database/enums";
import { DataTable } from "../ui/data-table";
export interface WikiPageRow { id: string; title: string; href: string; type: PageType; visibility: Visibility; publishStatus: PublishStatus; tags: string[]; updatedAt: string; }
const DATE_FMT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const columns: ColumnDef<WikiPageRow>[] = [
  { accessorKey: "title", header: "Titel", cell: ({ row }) => <Link href={row.original.href} className="font-medium hover:underline">{row.original.title}</Link> },
  { accessorKey: "type", header: "Typ", cell: ({ row }) => <PageTypeBadge type={row.original.type} /> },
  { accessorKey: "tags", header: "Tags", enableSorting: false, cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.tags.join(", ") || "—"}</span> },
  { accessorKey: "visibility", header: "Sichtbarkeit", cell: ({ row }) => <VisibilityBadge visibility={row.original.visibility} /> },
  { accessorKey: "publishStatus", header: "Status", cell: ({ row }) => <PublishBadge status={row.original.publishStatus} /> },
  { accessorKey: "updatedAt", header: "Geändert", cell: ({ row }) => <time dateTime={row.original.updatedAt} className="text-xs text-muted-foreground">{DATE_FMT.format(new Date(row.original.updatedAt))}</time> },
];
export function WikiPageTable({ rows, className }: { rows: WikiPageRow[]; className?: string }) {
  return <DataTable columns={columns} data={rows} filterPlaceholder="Seiten durchsuchen…" pageSize={25} className={className} />;
}
