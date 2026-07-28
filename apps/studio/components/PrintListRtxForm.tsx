"use client";

import {} from "react";
import { enqueueLabelPrintAction } from "@/app/label-print-actions";
import { Button, Label } from "@/src/components/ui";

/** TODO(design-kit): natives select bleibt — Server-Action-Formular (FormData)
    braucht name/defaultValue ohne Client-State, siehe PageChroniclePanel.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
/** TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */

interface PrinterOption { key: string; label: string; }

interface Props {
  worldSlug: string;
  printListId: string;
  returnTo: string;
  printers: PrinterOption[];
  defaultPrinterKey?: string;
  totalCopies: number;
  labelCount: number;
}

export function PrintListRtxForm({ worldSlug, printListId, returnTo, printers, defaultPrinterKey, totalCopies, labelCount }: Props) {
  const canSubmit = true;

  return (
    <form action={enqueueLabelPrintAction} className="flex flex-col gap-4">
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="printListId" value={printListId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <p className="text-sm text-muted-foreground">
        Sendet alle {labelCount} Label{labelCount === 1 ? "" : "s"} mit insgesamt {totalCopies} Kopie{totalCopies === 1 ? "" : "n"} als einen RTX-Batch-Job.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="print-list-rtx-printer">Drucker</Label>
        <select
          id="print-list-rtx-printer"
          name="printerKey"
          required
          defaultValue={defaultPrinterKey}
          className={NATIVE_SELECT_CLASS}
        >
          {printers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="print-list-rtx-format">Format</Label>
        <select id="print-list-rtx-format" name="format" defaultValue="pdf" className={NATIVE_SELECT_CLASS}>
          <option value="pdf">PDF</option>
          <option value="html">HTML</option>
        </select>
      </div>
      <Button type="submit" disabled={!canSubmit} className="self-start">
        Gesamte Liste an RTX senden
      </Button>
    </form>
  );
}
