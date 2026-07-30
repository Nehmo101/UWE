"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Input } from "./input";
import { Button } from "./button";
import { cn } from "./cn";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Enable the global filter input. */
  filterable?: boolean;
  filterPlaceholder?: string;
  pageSize?: number;
  className?: string;
  /**
   * Bezeichnung der Tabelle für Screenreader. Ohne sie meldet sich die Tabelle
   * nur als „Tabelle mit 7 Spalten".
   */
  caption?: string;
}

/**
 * Spalten-Zusatzangaben, die `design-v3/data.css` in der Mobilansicht liest.
 * Sie stehen in `meta`, weil TanStack dort den vorgesehenen Platz für
 * anwendungseigene Spalteninformationen hat.
 */
export interface DataTableColumnMeta {
  /** Beschriftung, die mobil vor dem Wert steht. */
  label?: string;
  /** Leitspalte: trägt mobil die Karte, ohne vorangestellte Beschriftung. */
  primary?: boolean;
  /** Zahlenspalte — rechtsbündig, Tabellenziffern. */
  numeric?: boolean;
  /** `low` blendet die Spalte auf dem Telefon aus. Nie für Handlungsrelevantes. */
  priority?: "normal" | "low";
}

function columnMeta<TData, TValue>(column: ColumnDef<TData, TValue>): DataTableColumnMeta {
  return (column.meta as DataTableColumnMeta | undefined) ?? {};
}

function columnLabel<TData, TValue>(column: ColumnDef<TData, TValue>): string {
  const meta = columnMeta(column);
  if (meta.label) return meta.label;
  if (typeof column.header === "string") return column.header;
  if ("accessorKey" in column && typeof column.accessorKey === "string") return column.accessorKey;
  return column.id ?? "Spalte";
}

/** Generic, sortable, filterable, paginated table built on TanStack Table. */
export function DataTable<TData, TValue>({
  columns,
  data,
  filterable = true,
  filterPlaceholder = "Filtern…",
  pageSize = 25,
  className,
  caption = "Tabelle",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {filterable ? (
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={filterPlaceholder}
          className="max-w-xs"
        />
      ) : null}

      {/*
        Die Klassen und `data-`Attribute hier sind der Vertrag mit
        `design-v3/data.css`: auf dem Telefon wird aus jeder Zeile eine Karte,
        die Spaltenüberschrift wandert als `data-label` vor den Wert. `role`
        steht ausdrücklich dabei, weil `display: flex` in Chrome und Safari die
        impliziten Tabellenrollen entfernt.
      */}
      <div className="uwe-table-wrap" data-mobile="cards">
        <table className="uwe-table-v3" role="table">
          <caption className="uwe-visually-hidden">{caption}</caption>
          <thead role="rowgroup">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map((header) => {
                  const meta = columnMeta(header.column.columnDef);
                  return (
                    <th
                      key={header.id}
                      role="columnheader"
                      scope="col"
                      data-numeric={meta.numeric ? "true" : undefined}
                      data-priority={meta.priority === "low" ? "low" : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1",
                            header.column.getCanSort() && "cursor-pointer select-none",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody role="rowgroup">
            {table.getRowModel().rows.length === 0 ? (
              <tr role="row">
                <td role="cell" colSpan={columns.length} className="text-center text-muted-foreground">
                  Keine Einträge.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} role="row">
                  {row.getVisibleCells().map((cell) => {
                    const meta = columnMeta(cell.column.columnDef);
                    const Cell = meta.primary ? "th" : "td";
                    return (
                      <Cell
                        key={cell.id}
                        role={meta.primary ? "rowheader" : "cell"}
                        scope={meta.primary ? "row" : undefined}
                        data-label={meta.primary ? undefined : columnLabel(cell.column.columnDef)}
                        data-primary={meta.primary ? "true" : undefined}
                        data-numeric={meta.numeric ? "true" : undefined}
                        data-priority={meta.priority === "low" ? "low" : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Cell>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Seite {table.getState().pagination.pageIndex + 1} von {table.getPageCount()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Weiter
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
