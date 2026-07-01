"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEV_IDEA_LIFECYCLES,
  DEV_IDEA_MATURITY_LEVELS,
  DEV_IDEA_MODULES,
  DEV_IDEA_TYPES,
  parseIdeaWorkspaceView,
} from "@uwe/database/dev-idea-constants";
import {
  createDevIdeaService,
  DEV_IDEA_STATUSES,
  prisma,
  syncFeatureMatrixToDevIdeas,
  type DevIdeaLifecycle,
  type DevIdeaStatus,
  type DevIdeaType,
} from "@uwe/database/server";
import { requireAdminAccess, requireOwner } from "@/src/lib/auth";

function ideas() { return createDevIdeaService(prisma); }
function parseStatus(v: FormDataEntryValue | null): DevIdeaStatus | undefined {
  const c = String(v ?? ""); return (DEV_IDEA_STATUSES as readonly string[]).includes(c) ? (c as DevIdeaStatus) : undefined;
}
function parseIdeaType(v: FormDataEntryValue | null): DevIdeaType | undefined {
  const c = String(v ?? ""); return (DEV_IDEA_TYPES as readonly string[]).includes(c) ? (c as DevIdeaType) : undefined;
}
function parseLifecycle(v: FormDataEntryValue | null): DevIdeaLifecycle | undefined {
  const c = String(v ?? ""); return (DEV_IDEA_LIFECYCLES as readonly string[]).includes(c) ? (c as DevIdeaLifecycle) : undefined;
}
function parseOptionalModule(v: FormDataEntryValue | null): string | null {
  const c = String(v ?? "").trim(); if (!c) return null; return (DEV_IDEA_MODULES as readonly string[]).includes(c) ? c : null;
}
function parseOptionalMaturity(v: FormDataEntryValue | null): string | null {
  const c = String(v ?? "").trim(); if (!c) return null; return (DEV_IDEA_MATURITY_LEVELS as readonly string[]).includes(c) ? c : null;
}
function ideasRedirectPath(formData: FormData, ideaId: string): string {
  const params = new URLSearchParams(); params.set("idea", ideaId);
  const view = parseIdeaWorkspaceView(String(formData.get("view") ?? ""));
  if (view !== "all") params.set("view", view);
  const lifecycle = String(formData.get("lifecycle") ?? "").trim();
  if (lifecycle && (DEV_IDEA_LIFECYCLES as readonly string[]).includes(lifecycle)) params.set("lifecycle", lifecycle);
  const moduleFilter = String(formData.get("module") ?? "").trim();
  if (moduleFilter && (DEV_IDEA_MODULES as readonly string[]).includes(moduleFilter)) params.set("module", moduleFilter);
  return `/ideas?${params.toString()}`;
}
export async function createIdeaAction(formData: FormData): Promise<void> {
  await requireOwner(); const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Titel ist erforderlich.");
  const idea = await ideas().createIdea({ title, body: String(formData.get("body") ?? ""), status: parseStatus(formData.get("status")) ?? "in_planning", ideaType: parseIdeaType(formData.get("ideaType")) ?? "feature", lifecycle: parseLifecycle(formData.get("lifecycle")) ?? "planned", module: parseOptionalModule(formData.get("module")), maturityLevel: parseOptionalMaturity(formData.get("maturityLevel")) });
  revalidatePath("/ideas"); redirect(ideasRedirectPath(formData, idea.id));
}
export async function updateIdeaAction(formData: FormData): Promise<void> {
  await requireOwner(); const id = String(formData.get("id") ?? ""); if (!id) throw new Error("Idee-ID fehlt.");
  await ideas().updateIdea(id, { title: String(formData.get("title") ?? "").trim(), body: String(formData.get("body") ?? ""), ideaType: parseIdeaType(formData.get("ideaType")), lifecycle: parseLifecycle(formData.get("lifecycle")), module: parseOptionalModule(formData.get("module")), maturityLevel: parseOptionalMaturity(formData.get("maturityLevel")) });
  revalidatePath("/ideas"); redirect(ideasRedirectPath(formData, id));
}
export async function updateIdeaStatusAction(formData: FormData): Promise<void> {
  await requireOwner(); const id = String(formData.get("id") ?? ""); const status = parseStatus(formData.get("status"));
  if (!id || !status) throw new Error("Idee-ID und gültiger Status sind erforderlich.");
  await ideas().updateStatus(id, status); revalidatePath("/ideas"); redirect(ideasRedirectPath(formData, id));
}
export async function deleteIdeaAction(formData: FormData): Promise<void> {
  await requireOwner(); const id = String(formData.get("id") ?? ""); if (!id) throw new Error("Idee-ID fehlt.");
  await ideas().deleteIdea(id); revalidatePath("/ideas");
  const params = new URLSearchParams(); const view = parseIdeaWorkspaceView(String(formData.get("view") ?? ""));
  if (view !== "all") params.set("view", view); redirect(params.toString() ? `/ideas?${params.toString()}` : "/ideas");
}
export async function syncFeatureMatrixAction(formData: FormData): Promise<void> {
  await requireAdminAccess();
  await syncFeatureMatrixToDevIdeas(prisma);
  revalidatePath("/ideas");
  const params = new URLSearchParams();
  params.set("view", "features");
  const lifecycle = String(formData.get("lifecycle") ?? "").trim();
  if (lifecycle && (DEV_IDEA_LIFECYCLES as readonly string[]).includes(lifecycle)) params.set("lifecycle", lifecycle);
  const moduleFilter = String(formData.get("module") ?? "").trim();
  if (moduleFilter && (DEV_IDEA_MODULES as readonly string[]).includes(moduleFilter)) params.set("module", moduleFilter);
  redirect(`/ideas?${params.toString()}`);
}
