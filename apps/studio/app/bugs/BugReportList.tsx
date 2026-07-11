"use client";

import {
  deleteBugReportAction,
  updateBugReportSeverityAction,
  updateBugReportStatusAction,
} from "../bug-actions";
import {
  BugSeverityBadge,
  BugStatusBadge,
  BUG_SEVERITY_ORDER,
  BUG_STATUS_ORDER,
} from "./bug-badges";
import {
  BUG_REPORT_SEVERITY_LABELS,
  BUG_REPORT_STATUS_LABELS,
} from "./bug-constants";
import type { BugReportDto } from "./BugWorkspaceClient";
import {
  Button,
  buttonVariants,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";

interface BugReportListProps {
  reports: BugReportDto[];
  selectedId: string | null;
  filterStatus?: string;
  filterSeverity?: string;
  onSelect: (id: string) => void;
}

/** Native select styling used where Kit-Select (Radix) cannot be used — see TODO(design-kit) below. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function BugReportList({
  reports,
  selectedId,
  filterStatus,
  filterSeverity,
  onSelect,
}: BugReportListProps) {
  return (
    <>
      {/* TODO(design-kit): Filter-Selects bleiben nativ — GET-Formular mit Leerwert-Option
          ("Alle"), Kit-Select (Radix) erlaubt keinen value="". */}
      <form
        method="get"
        action="/bugs"
        className="flex flex-wrap items-end gap-3 border-t border-border pt-3"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          Status
          <select name="status" defaultValue={filterStatus ?? ""} className={NATIVE_SELECT_CLASS}>
            <option value="">Alle</option>
            {BUG_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {BUG_REPORT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Schweregrad
          <select name="severity" defaultValue={filterSeverity ?? ""} className={NATIVE_SELECT_CLASS}>
            <option value="">Alle</option>
            {BUG_SEVERITY_ORDER.map((severity) => (
              <option key={severity} value={severity}>
                {BUG_REPORT_SEVERITY_LABELS[severity]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary" size="sm">
            Filtern
          </Button>
          {(filterStatus || filterSeverity) && (
            <a href="/bugs" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Zurücksetzen
            </a>
          )}
        </div>
      </form>

      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Bug-Meldungen für die aktuelle Filterung.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reports.map((report) => (
            <li
              key={report.id}
              className={cn(
                "rounded-[var(--radius)] border border-border p-2.5",
                report.id === selectedId && "border-primary ring-1 ring-primary",
              )}
            >
              <button
                type="button"
                className="flex w-full flex-col items-start gap-1.5 text-left"
                aria-pressed={report.id === selectedId}
                onClick={() => onSelect(report.id)}
              >
                <span className="font-semibold">{report.title}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <BugSeverityBadge severity={report.severity} />
                  <BugStatusBadge status={report.status} />
                </span>
              </button>
              {report.module ? (
                <p className="mt-1 text-sm text-muted-foreground">{report.module}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <form action={updateBugReportStatusAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={report.id} />
                  {filterStatus ? (
                    <input type="hidden" name="filterStatus" value={filterStatus} />
                  ) : null}
                  {filterSeverity ? (
                    <input type="hidden" name="filterSeverity" value={filterSeverity} />
                  ) : null}
                  <Select name="status" defaultValue={report.status}>
                    <SelectTrigger className="h-8 w-auto gap-1 px-2 text-xs" aria-label="Status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUG_STATUS_ORDER.map((status) => (
                        <SelectItem key={status} value={status}>
                          {BUG_REPORT_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="ghost" size="sm">
                    Status
                  </Button>
                </form>
                <form action={updateBugReportSeverityAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={report.id} />
                  {filterStatus ? (
                    <input type="hidden" name="filterStatus" value={filterStatus} />
                  ) : null}
                  {filterSeverity ? (
                    <input type="hidden" name="filterSeverity" value={filterSeverity} />
                  ) : null}
                  <Select name="severity" defaultValue={report.severity}>
                    <SelectTrigger className="h-8 w-auto gap-1 px-2 text-xs" aria-label="Schweregrad">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUG_SEVERITY_ORDER.map((severity) => (
                        <SelectItem key={severity} value={severity}>
                          {BUG_REPORT_SEVERITY_LABELS[severity]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" variant="ghost" size="sm">
                    Schwere
                  </Button>
                </form>
                <form action={deleteBugReportAction}>
                  <input type="hidden" name="id" value={report.id} />
                  {filterStatus ? (
                    <input type="hidden" name="filterStatus" value={filterStatus} />
                  ) : null}
                  {filterSeverity ? (
                    <input type="hidden" name="filterSeverity" value={filterSeverity} />
                  ) : null}
                  <Button type="submit" variant="ghost" size="sm">
                    Löschen
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
