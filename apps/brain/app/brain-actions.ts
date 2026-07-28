"use server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createMiniatureCollectionService,
  type CaptureStatus,
  type CaptureType,
  type MiniatureCollectionStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";
import { lifeAdmin, revalidateBrainPaths, str } from "@/src/lib/brain-action-shared";

function parseCommaTags(formData: FormData, field = "tags"): string[] {
  return str(formData.get(field))
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/* ── Capture ─────────────────────────────────────────────────────────── */

export async function createCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  const content = str(formData.get("content"));
  if (!title && !content) return;

  await lifeAdmin().createCapture({
    title,
    content,
    captureType: (str(formData.get("captureType")) || "quick_note") as CaptureType,
    status: "inbox",
  });
  revalidateBrainPaths();
}

export async function deleteCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deleteCapture(id);
  revalidateBrainPaths();
}

/* ── Personal Brain: facts + documents ───────────────────────────────── */

export async function createBrainFactAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await lifeAdmin().createPersonalBrainFact({
    title,
    content: str(formData.get("content")),
    factType: str(formData.get("factType")) || "custom",
    tags: parseCommaTags(formData),
  });
  revalidateBrainPaths();
}

export async function deleteBrainFactAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deletePersonalBrainFact(id);
  revalidateBrainPaths();
}

export async function createBrainDocumentAction(formData: FormData) {
  await requireBrainActionAuth();
  const title = str(formData.get("title"));
  if (!title) return;

  await lifeAdmin().createPersonalBrainDocument({
    title,
    content: str(formData.get("content")),
    category: str(formData.get("category")) || null,
    tags: parseCommaTags(formData),
  });
  revalidateBrainPaths();
}

export async function deleteBrainDocumentAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await lifeAdmin().deletePersonalBrainDocument(id);
  revalidateBrainPaths();
}

/* ── Personal Projects (+ steps) ─────────────────────────────────────── */

/* ── Workshop ────────────────────────────────────────────────────────── */

/* ── Hardware ────────────────────────────────────────────────────────── */

/* ══ Edit (update) actions ═══════════════════════════════════════════ */

export async function updateCaptureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updateCapture(id, {
    title: str(formData.get("title")),
    content: str(formData.get("content")),
    captureType: (str(formData.get("captureType")) || "quick_note") as CaptureType,
    status: (str(formData.get("status")) || "inbox") as CaptureStatus,
  });
  revalidateBrainPaths();
}

export async function updateBrainFactAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updatePersonalBrainFact(id, {
    title: str(formData.get("title")),
    content: str(formData.get("content")),
    factType: str(formData.get("factType")) || "custom",
    tags: parseCommaTags(formData),
  });
  revalidateBrainPaths();
}

export async function updateBrainDocumentAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await lifeAdmin().updatePersonalBrainDocument(id, {
    title: str(formData.get("title")),
    content: str(formData.get("content")),
    category: str(formData.get("category")) || null,
    tags: parseCommaTags(formData),
  });
  revalidateBrainPaths();
}

/* ══ Miniatures collection ═══════════════════════════════════════════ */

function miniatures() {
  return createMiniatureCollectionService(brainPrisma);
}

function parseQuantity(value: FormDataEntryValue | null): number {
  const n = Number.parseInt(str(value), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function createMiniatureAction(formData: FormData) {
  await requireBrainActionAuth();
  const name = str(formData.get("name"));
  if (!name) return;
  await miniatures().createItem({
    name,
    manufacturer: str(formData.get("manufacturer")) || null,
    gameSystem: str(formData.get("gameSystem")) || null,
    faction: str(formData.get("faction")) || null,
    quantity: parseQuantity(formData.get("quantity")),
    status: (str(formData.get("status")) || "purchased") as MiniatureCollectionStatus,
    notes: str(formData.get("notes")),
  });
  revalidatePath("/miniatures");
}

export async function updateMiniatureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  await miniatures().updateItem(id, {
    name: str(formData.get("name")),
    manufacturer: str(formData.get("manufacturer")) || null,
    gameSystem: str(formData.get("gameSystem")) || null,
    faction: str(formData.get("faction")) || null,
    quantity: parseQuantity(formData.get("quantity")),
    status: (str(formData.get("status")) || "purchased") as MiniatureCollectionStatus,
    notes: str(formData.get("notes")),
  });
  revalidatePath("/miniatures");
}

export async function deleteMiniatureAction(formData: FormData) {
  await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await miniatures().deleteItem(id);
  revalidatePath("/miniatures");
}

/* Die acht Mail-Actions sind mit H10 entfallen: das Mail-Center spricht seine
   eigene API unter /api/mail/**, formularbasierte Server-Actions daneben wären
   ein zweiter Weg zum selben Postfach. */

