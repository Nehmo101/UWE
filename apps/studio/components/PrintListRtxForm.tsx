"use client";

import { useState } from "react";
import { enqueueLabelPrintAction } from "@/app/label-print-actions";

interface PrinterOption { key: string; label: string; }

interface Props {
  worldSlug: string;
  printListId: string;
  returnTo: string;
  printers: PrinterOption[];
  defaultPrinterKey?: string;
  hasDmOnly: boolean;
  totalCopies: number;
  labelCount: number;
}

export function PrintListRtxForm({ worldSlug, printListId, returnTo, printers, defaultPrinterKey, hasDmOnly, totalCopies, labelCount }: Props) {
  const [confirmDmOnlyBatch, setConfirmDmOnlyBatch] = useState(false);
  const [includeDmOnly, setIncludeDmOnly] = useState(false);
  const needsDmConfirmation = hasDmOnly;
  const canSubmit = !needsDmConfirmation || confirmDmOnlyBatch;

  return (
    <form action={enqueueLabelPrintAction} className="uwe-form-grid">
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="printListId" value={printListId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <p className="uwe-table-sub">
        Sendet alle {labelCount} Label{labelCount === 1 ? "" : "s"} mit insgesamt {totalCopies} Kopie{totalCopies === 1 ? "" : "n"} als einen RTX-Batch-Job.
      </p>
      <label>Drucker<select name="printerKey" required defaultValue={defaultPrinterKey}>{printers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
      <label>Format<select name="format" defaultValue="pdf"><option value="pdf">PDF</option><option value="html">HTML</option></select></label>
      <label className="uwe-checkbox"><input type="checkbox" name="includeDmOnly" checked={includeDmOnly} onChange={(e) => setIncludeDmOnly(e.target.checked)} /> DM-only Inhalte im Druck einschließen</label>
      {needsDmConfirmation ? (
        <label className="uwe-checkbox"><input type="checkbox" name="confirmDmOnlyBatch" checked={confirmDmOnlyBatch} onChange={(e) => setConfirmDmOnlyBatch(e.target.checked)} /> Ich bestätige den Batch-Druck dieser Liste mit DM-only Inhalten.</label>
      ) : null}
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={!canSubmit}>Gesamte Liste an RTX senden</button>
    </form>
  );
}
