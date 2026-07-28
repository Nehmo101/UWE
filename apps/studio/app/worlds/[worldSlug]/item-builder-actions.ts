"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAppRepository,
  resolveDndApiConfig,
} from "@uwe/database/server";
import {
  formatDnd5eSrdEquipmentAsMarkdown,
  formatOpen5eEquipmentAsMarkdown,
  getDnd5eResource,
  getOpen5eEquipment,
  summarizeOpen5eEquipment,
  type Open5eEquipmentKind,
} from "@uwe/dnd-api";
import { parseFormDataOrThrow, studioApplySrdEquipmentSchema } from "@uwe/security";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioContentEdit } from "@/src/lib/authz";

function editPath(worldSlug: string, category: string, pageSlug: string) {
  return `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;
}

function parseOpen5eEquipmentId(equipmentId: string): { kind: Open5eEquipmentKind; slug: string } | null {
  const match = equipmentId.match(/^(weapon|magicitem):(.+)$/);
  if (!match) return null;
  return { kind: match[1] as Open5eEquipmentKind, slug: match[2] };
}

function truncateSummary(value: string, max = 320): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

async function resolveEquipmentMarkdown(input: {
  provider: "open5e" | "dnd5e_srd";
  equipmentId: string;
  name: string;
}): Promise<{ summary: string; content: string }> {
  const config = resolveDndApiConfig();
  const clientOptions = {
    open5eEnabled: config.open5eEnabled,
    dnd5eSrdEnabled: config.dnd5eSrdEnabled,
  };

  if (input.provider === "open5e") {
    const parsed = parseOpen5eEquipmentId(input.equipmentId);
    if (!parsed) {
      throw new Error("Open5e-Ausrüstung konnte nicht aufgelöst werden.");
    }
    const raw = await getOpen5eEquipment(parsed.kind, parsed.slug, clientOptions);
    const summary =
      summarizeOpen5eEquipment(parsed.kind, raw) ??
      (parsed.kind === "magicitem" && typeof raw === "object" && raw !== null
        ? truncateSummary(String((raw as { desc?: unknown }).desc ?? input.name))
        : input.name);
    return {
      summary,
      content: formatOpen5eEquipmentAsMarkdown(parsed.kind, raw),
    };
  }

  const raw = await getDnd5eResource(`/equipment/${input.equipmentId}`, clientOptions);
  const content = formatDnd5eSrdEquipmentAsMarkdown(raw);
  const desc =
    typeof raw === "object" &&
    raw !== null &&
    Array.isArray((raw as { desc?: unknown }).desc)
      ? ((raw as { desc: unknown[] }).desc
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean)
          .join(" "))
      : "";
  return {
    summary: truncateSummary(desc || input.name),
    content: content || `## ${input.name}`,
  };
}

export async function applySrdEquipmentToItemAction(formData: FormData) {
  await requireStudioActionAuth();

  const parsed = parseFormDataOrThrow(formData, studioApplySrdEquipmentSchema);
  const { worldSlug, pageId, pageSlug, category, provider, equipmentId, name } = parsed;
  await requireStudioContentEdit(worldSlug, pageId);

  const repo = getAppRepository();
  const page = await repo.getPageById(pageId);
  if (!page || page.type !== "item") {
    throw new Error("SRD-Ausrüstung ist nur für Item-Seiten verfügbar.");
  }

  const { summary, content } = await resolveEquipmentMarkdown({
    provider,
    equipmentId,
    name,
  });

  await repo.updatePage(pageId, {
    title: name,
    summary,
  });

  await repo.createContentBlock(pageId, {
    type: "rich_text",
    sortOrder: page.contentBlocks.length,
    content,
  });

  revalidatePath(editPath(worldSlug, category, pageSlug));
  redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
}
