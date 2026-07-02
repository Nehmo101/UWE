"use client";

import Link from "next/link";
import {
  EquipmentSearchBox,
  equipmentKindLabel,
  type EquipmentSearchResult,
} from "@/components/wiki/EquipmentSearchBox";

export type { EquipmentSearchResult } from "@/components/wiki/EquipmentSearchBox";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
  pageTitle: string;
  pageSummary: string | null;
  searchEquipmentUrl: string;
  applyEquipmentAction: (formData: FormData) => void | Promise<void>;
  generatorSectionId?: string;
}

export function ItemBuilderPanel({
  worldSlug,
  pageId,
  pageSlug,
  category,
  pageTitle,
  pageSummary,
  searchEquipmentUrl,
  applyEquipmentAction,
  generatorSectionId = "item-structured-generator",
}: Props) {
  const hiddenFields = {
    worldSlug,
    pageId,
    pageSlug,
    category,
  };

  function renderResult(result: EquipmentSearchResult) {
    const label = equipmentKindLabel(result.kind);
    return (
      <form action={applyEquipmentAction} className="auth-character-spell-search-form">
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="provider" value={result.provider} />
        <input type="hidden" name="equipmentId" value={result.id} />
        <input type="hidden" name="name" value={result.name} />
        {result.url ? <input type="hidden" name="sourceUrl" value={result.url} /> : null}
        <button type="submit" className="auth-btn auth-btn-small">
          {result.name}
          {label ? ` · ${label}` : null}
          {result.summary ? ` — ${result.summary}` : null}
        </button>
      </form>
    );
  }

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Magic Item Builder</h2>
      <p className="uwe-dashboard-muted">
        SRD- und Open5e-Ausrüstung suchen, als Basis übernehmen oder im strukturierten
        Generator weiter ausarbeiten.
      </p>

      <p className="uwe-hint">
        Aktuell: <strong>{pageTitle}</strong>
        {pageSummary?.trim() ? <> — {pageSummary.trim()}</> : null}
      </p>

      <EquipmentSearchBox
        searchEquipmentUrl={searchEquipmentUrl}
        label="SRD / Open5e Ausrüstung"
        renderResult={renderResult}
      />

      <p className="uwe-dashboard-muted">
        <Link href={`#${generatorSectionId}`}>Zum strukturierten Item-Generator ↓</Link>
      </p>
    </section>
  );
}
