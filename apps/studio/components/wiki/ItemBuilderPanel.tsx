"use client";

import Link from "next/link";
import {
  EquipmentSearchBox,
  equipmentKindLabel,
  type EquipmentSearchResult,
} from "@/components/wiki/EquipmentSearchBox";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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
      <form action={applyEquipmentAction}>
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="provider" value={result.provider} />
        <input type="hidden" name="equipmentId" value={result.id} />
        <input type="hidden" name="name" value={result.name} />
        {result.url ? <input type="hidden" name="sourceUrl" value={result.url} /> : null}
        <Button type="submit" variant="outline" size="sm">
          {result.name}
          {label ? ` · ${label}` : null}
          {result.summary ? ` — ${result.summary}` : null}
        </Button>
      </form>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Magic Item Builder</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          SRD- und Open5e-Ausrüstung suchen, als Basis übernehmen oder im strukturierten
          Generator weiter ausarbeiten.
        </p>

        <p className="text-sm text-muted-foreground">
          Aktuell: <strong>{pageTitle}</strong>
          {pageSummary?.trim() ? <> — {pageSummary.trim()}</> : null}
        </p>

        <EquipmentSearchBox
          searchEquipmentUrl={searchEquipmentUrl}
          label="SRD / Open5e Ausrüstung"
          renderResult={renderResult}
        />

        <p className="text-sm text-muted-foreground">
          <Link href={`#${generatorSectionId}`}>Zum strukturierten Item-Generator ↓</Link>
        </p>
      </CardContent>
    </Card>
  );
}
