import type { WorkshopProject, WorkshopProjectType } from "./generated/prisma/client";
import type { LabelContentData, LabelLayoutSettings } from "./label-service";
import { defaultElementsForMode } from "./label-elements";

export const WORKSHOP_LABEL_TEMPLATE_SLUGS: Record<string, string> = {
  miniature: "miniature-box",
  dnd_terrain: "terrain-box",
  printing_3d: "3d-print-project",
  diorama: "terrain-box",
  artwork: "standard-6x4",
  other: "standard-6x4",
};

export interface FilamentEntry {
  material?: string;
  color?: string;
  brand?: string;
  weightGrams?: number;
  notes?: string;
}

export interface MaterialEntry {
  name?: string;
  quantity?: string;
  notes?: string;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

export function resolveWorkshopLabelTemplateSlug(projectType: WorkshopProjectType): string {
  return WORKSHOP_LABEL_TEMPLATE_SLUGS[projectType] ?? "standard-6x4";
}

export function resolveFilamentLabelTemplateSlug(): string {
  return "filament-spool";
}

export function buildWorkshopLabelContent(
  project: Pick<
    WorkshopProject,
    "title" | "projectType" | "description" | "materialsNeeded" | "filamentsUsed" | "notes" | "nextAction"
  >,
  options?: { pageUrl?: string | null; imageAssetId?: string | null },
): LabelContentData {
  const materials = parseJsonArray<MaterialEntry>(project.materialsNeeded)
    .map((entry) => [entry.name, entry.quantity].filter(Boolean).join(" × "))
    .filter(Boolean)
    .join("\n");

  const filaments = parseJsonArray<FilamentEntry>(project.filamentsUsed)
    .map((entry) =>
      [entry.brand, entry.material, entry.color].filter(Boolean).join(" · ") ||
        entry.notes ||
        "",
    )
    .filter(Boolean)
    .join("\n");

  const lines = [
    project.description?.trim(),
    materials ? `Material:\n${materials}` : "",
    filaments ? `Filament:\n${filaments}` : "",
    project.nextAction ? `Nächster Schritt: ${project.nextAction}` : "",
    project.notes?.trim(),
  ].filter(Boolean);

  const text = lines.join("\n\n").slice(0, 800);

  const baseContent: LabelContentData = {
    title: project.title,
    text,
    summary: project.description ?? undefined,
    imageAssetId: options?.imageAssetId ?? null,
    sourceTitle: project.title,
    containsDmOnly: false,
    dmOnlyBlockCount: 0,
    editorMode: "visual",
  };

  const elements = defaultElementsForMode(baseContent, "image_text");

  if (options?.pageUrl) {
    elements.push({
      id: `qr_${project.title.slice(0, 12).replace(/\s+/g, "_")}`,
      type: "qr",
      x: 4.8,
      y: 0.2,
      width: 1.0,
      height: 1.0,
      zIndex: 10,
      visible: true,
      url: options.pageUrl,
    });
  }

  return {
    ...baseContent,
    elements,
  };
}

export function buildFilamentLabelContent(
  filament: FilamentEntry,
  options?: { spoolId?: string },
): LabelContentData {
  const title = [filament.brand, filament.material].filter(Boolean).join(" ") || "Filament";
  const lines = [
    filament.color ? `Farbe: ${filament.color}` : "",
    filament.weightGrams ? `Gewicht: ${filament.weightGrams} g` : "",
    filament.notes?.trim(),
    options?.spoolId ? `ID: ${options.spoolId}` : "",
  ].filter(Boolean);

  return {
    title,
    text: lines.join("\n").slice(0, 300),
    sourceTitle: title,
    containsDmOnly: false,
    dmOnlyBlockCount: 0,
    elements: defaultElementsForMode(
      { title, text: lines.join("\n").slice(0, 300) },
      "text_only",
    ),
    editorMode: "visual",
  };
}

export function buildWorkshopLabelLayout(projectType: WorkshopProjectType): Partial<LabelLayoutSettings> {
  if (projectType === "printing_3d") {
    return {
      mode: "image_text",
      widthInches: 6,
      heightInches: 4,
      maxChars: 600,
    };
  }

  if (projectType === "miniature" || projectType === "dnd_terrain" || projectType === "diorama") {
    return {
      mode: "image_text",
      widthInches: 6,
      heightInches: 4,
      maxChars: 500,
    };
  }

  return {
    mode: "image_text",
    widthInches: 6,
    heightInches: 4,
  };
}

export function buildUwePageQrUrl(baseUrl: string, worldSlug: string, pageSlug: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  return `${normalized}/worlds/${worldSlug}/${pageSlug}`;
}
