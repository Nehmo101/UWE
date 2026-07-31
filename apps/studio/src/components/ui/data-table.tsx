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
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Columns3 } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "./cn";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Enable the global filter input. */
  filterable?: boolean;
  filterPlaceholder?: string;
  pageSize?: number;
  className?: string;
  /** Show a dropdown to toggle optional column visibility (TanStack `columnVisibility`). */
  enableColumnVisibility?: boolean;
  /** Persist column visibility in `localStorage` when set. */
  columnVisibilityStorageKey?: string;
  /** Add a leading checkbox column and enable multi-row selection. */
  enableRowSelection?: boolean;
  /** Stable row id used as the selection key (e.g. the entity id). */
  getRowId?: (row: TData) => string;
  /** Render a batch-action bar shown while rows are selected. */
  renderBatchActions?: (args: {
    selectedIds: string[];
    clearSelection: () => void;
  }) => React.ReactNode;
  /** Client-side pagination (default: true). */
  enablePagination?: boolean;
  /**
   * Bezeichnung der Tabelle für Screenreader. Ohne sie meldet sich die
   * Tabelle nur als „Tabelle mit 7 Spalten"; auf einer Seite mit mehreren
   * Tabellen ist das keine Auskunft.
   */
  caption?: string;
}

function readStoredColumnVisibility(key: string): VisibilityState {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? (parsed as VisibilityState) : {};
  } catch {
    return {};
  }
}

/**
 * Spalten-Zusatzangaben, die `design-v3/data.css` in der Mobilansicht liest.
 * Sie stehen in `meta`, weil TanStack dort den vorgesehenen Platz für
 * anwendungseigene Spalteninformationen hat.
 */
export interface DataTableColumnMeta {
  /** Beschriftung im Spalten-Umschalter und mobil vor dem Wert. */
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
  enableColumnVisibility = false,
  columnVisibilityStorageKey,
  enableRowSelection = false,
  getRowId,
  renderBatchActions,
  enablePagination = true,
  caption = "Tabelle",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() =>
    columnVisibilityStorageKey ? readStoredColumnVisibility(columnVisibilityStorageKey) : {},
  );

  React.useEffect(() => {
    if (!columnVisibilityStorageKey) return;
    window.localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(columnVisibility));
  }, [columnVisibility, columnVisibilityStorageKey]);

  const selectionColumn = React.useMemo<ColumnDef<TData, TValue>>(
    () => ({
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      meta: { label: "Auswahl" } satisfies DataTableColumnMeta,
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Alle auswählen"
          className="h-4 w-4 cursor-pointer"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) {
              el.indeterminate =
                table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
            }
          }}
          onChange={(event) => table.toggleAllPageRowsSelected(event.target.checked)}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Zeile auswählen"
          className="h-4 w-4 cursor-pointer"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    }),
    [],
  );

  const tableColumns = React.useMemo(
    () => (enableRowSelection ? [selectionColumn, ...columns] : columns),
    [enableRowSelection, selectionColumn, columns],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: enablePagination
      ? { pagination: { pageSize } }
      : { pagination: { pageSize: Math.max(data.length, 1) } },
  });

  const hideableColumns = table.getAllColumns().filter((column) => column.getCanHide());
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  const clearSelection = React.useCallback(() => setRowSelection({}), []);
  const selectedIds = React.useMemo(
    () =>
      enableRowSelection
        ? table
            .getSelectedRowModel()
            .rows.map((row) => (getRowId ? getRowId(row.original) : row.id))
        : [],
    // rowSelection drives the selected set; table is a stable instance ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableRowSelection, getRowId, rowSelection, table],
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {filterable || enableColumnVisibility ? (
        <div className="flex flex-wrap items-center gap-2">
          {filterable ? (
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder={filterPlaceholder}
              className="max-w-xs"
            />
          ) : null}
          {enableColumnVisibility && hideableColumns.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Spalten ein- oder ausblenden">
                  <Columns3 className="h-4 w-4" aria-hidden="true" />
                  Spalten
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
                {hideableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                  >
                    {columnLabel(column.columnDef)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      {enableRowSelection && renderBatchActions && selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm">
          {renderBatchActions({ selectedIds, clearSelection })}
        </div>
      ) : null}

      {/*
        Die Klassen und `data-`Attribute hier sind der Vertrag mit
        `design-v3/data.css`: auf dem Telefon wird aus jeder Zeile eine Karte,
        die Spaltenüberschrift wandert als `data-label` vor den Wert. Vorher
        wurde die Tabelle auf 390 px zusammengedrückt — winzige Schrift,
        abgeschnittene Spalten, waagerechtes Scrollen mitten im Text.

        `role` steht überall ausdrücklich dabei, weil `display: flex` in Chrome
        und Safari die impliziten Tabellenrollen entfernt; ohne sie läse ein
        Screenreader die Karten als zusammenhanglosen Textstapel.
      */}
      <div className="uwe-table-wrap" data-mobile="cards">
        <table className="uwe-table-v3" role="table">
          <caption className="uwe-visually-hidden">{caption}</caption>
          <thead role="rowgroup">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map((header) => {
                  if (!header.column.getIsVisible()) return null;
                  const meta = columnMeta(header.column.columnDef);
                  return (
                    <th
                      key={header.id}
                      role="columnheader"
                      scope="col"
                      data-numeric={meta.numeric ? "true" : undefined}
                      data-priority={meta.priority === "low" ? "low" : undefined}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer select-none items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
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
                <td role="cell" colSpan={visibleColumnCount || 1} className="text-center text-muted-foreground">
                  Keine Einträge.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} role="row">
                  {row.getVisibleCells().map((cell) => {
                    const meta = columnMeta(cell.column.columnDef);
                    // Die Leitspalte ist `th scope="row"` — ein Zeilenkopf. So
                    // weiß ein Screenreader, worauf sich die übrigen Zellen der
                    // Zeile beziehen.
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

      {enablePagination && table.getPageCount() > 1 ? (
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
