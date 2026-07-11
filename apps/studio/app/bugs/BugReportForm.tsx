import { Button, Input, Textarea } from "@/src/components/ui";
import { createBugReportAction } from "../bug-actions";
import { BugScreenshotUpload } from "./BugScreenshotUpload";
import { BUG_REPORT_SEVERITY_LABELS, BUG_SEVERITY_ORDER } from "./bug-constants";

interface BugReportFormProps {
  filterStatus?: string;
  filterSeverity?: string;
}

const FIELD_CLASS = "flex flex-col gap-1.5 text-sm";

/** TODO(design-kit): natives select bleibt — Server-Action-Formular (FormData) braucht
    name/defaultValue ohne Client-State, siehe gleiches Muster in SessionDetailClient.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function BugReportForm({ filterStatus, filterSeverity }: BugReportFormProps) {
  return (
    <form action={createBugReportAction} className="flex flex-col gap-3">
      {filterStatus ? <input type="hidden" name="filterStatus" value={filterStatus} /> : null}
      {filterSeverity ? <input type="hidden" name="filterSeverity" value={filterSeverity} /> : null}
      <label className={FIELD_CLASS}>
        Titel
        <Input name="title" required placeholder="z. B. Login schlägt fehl nach Update" />
      </label>
      <label className={FIELD_CLASS}>
        Beschreibung
        <Textarea name="description" rows={3} placeholder="Schritte, erwartetes Verhalten, Ist-Zustand…" />
      </label>
      <label className={FIELD_CLASS}>
        Schweregrad
        <select name="severity" defaultValue="medium" className={NATIVE_SELECT_CLASS}>
          {BUG_SEVERITY_ORDER.map((severity) => (
            <option key={severity} value={severity}>
              {BUG_REPORT_SEVERITY_LABELS[severity]}
            </option>
          ))}
        </select>
      </label>
      <label className={FIELD_CLASS}>
        Modul / Bereich
        <Input name="module" placeholder="z. B. Studio, Portal, Capture" list="bug-module-suggestions" />
        <datalist id="bug-module-suggestions">
          <option value="Studio" />
          <option value="Portal" />
          <option value="Capture" />
          <option value="Today" />
          <option value="Image Studio" />
          <option value="Life Brain" />
          <option value="Database" />
        </datalist>
      </label>
      <label className={FIELD_CLASS}>
        GitHub Issue (optional)
        <Input name="githubIssueUrl" type="url" placeholder="https://github.com/owner/repo/issues/123" />
      </label>
      <BugScreenshotUpload />
      <Button type="submit" size="sm">
        Bug melden
      </Button>
    </form>
  );
}
