import { createBugReportAction } from "../bug-actions";
import { BugScreenshotUpload } from "./BugScreenshotUpload";
import { BUG_REPORT_SEVERITY_LABELS, BUG_SEVERITY_ORDER } from "./bug-constants";

interface BugReportFormProps {
  filterStatus?: string;
  filterSeverity?: string;
}

export function BugReportForm({ filterStatus, filterSeverity }: BugReportFormProps) {
  return (
    <form action={createBugReportAction} className="uwe-brain-create-form">
      {filterStatus ? <input type="hidden" name="filterStatus" value={filterStatus} /> : null}
      {filterSeverity ? <input type="hidden" name="filterSeverity" value={filterSeverity} /> : null}
      <label>
        Titel
        <input name="title" required placeholder="z. B. Login schlägt fehl nach Update" />
      </label>
      <label>
        Beschreibung
        <textarea name="description" rows={3} placeholder="Schritte, erwartetes Verhalten, Ist-Zustand…" />
      </label>
      <label>
        Schweregrad
        <select name="severity" defaultValue="medium">
          {BUG_SEVERITY_ORDER.map((severity) => (
            <option key={severity} value={severity}>
              {BUG_REPORT_SEVERITY_LABELS[severity]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Modul / Bereich
        <input name="module" placeholder="z. B. Studio, Portal, Capture" list="bug-module-suggestions" />
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
      <label>
        GitHub Issue (optional)
        <input
          name="githubIssueUrl"
          type="url"
          placeholder="https://github.com/owner/repo/issues/123"
        />
      </label>
      <BugScreenshotUpload />
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
        Bug melden
      </button>
    </form>
  );
}
