"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  buildPageUrl,
  createActivityLogService,
  createPageTemplateService,
  createUndoService,
  getAppRepository,
  navCategoryForPageType,
  pickUniqueSlug,
  prisma,
  slugifyPageTitle,
  RevealStateEnum,
  SecretLevelEnum,
  type CreateContentBlockInput,
  type PageType,
  type Visibility,
  type PublishStatus,
  type CanonicalStatus,
  type ContentBlockType,
  type RevealState,
  type SecretLevel,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";

function repo() {
  return getAppRepository();
}

function activity() {
  return createActivityLogService(prisma);
}

function parseSecretLevel(value: FormDataEntryValue | null): SecretLevel {
  const raw = String(value ?? "none");
  return (Object.values(SecretLevelEnum) as SecretLevel[]).includes(raw as SecretLevel)
    ? (raw as SecretLevel)
    : "none";
}

function parseRevealState(value: FormDataEntryValue | null): RevealState {
  const raw = String(value ?? "hidden");
  return (Object.values(RevealStateEnum) as RevealState[]).includes(raw as RevealState)
    ? (raw as RevealState)
    : "hidden";
}

export async function updatePageAction(formData: FormData) {
  await requireStudioActionAuth();
  const pageId = String(formData.get("pageId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));

  await requireStudioContentEdit(worldSlug, pageId);

  // Capture old type/slug before the update so both old and new URLs are revalidated.
  const oldPage = await repo().getPageBySlug(worldSlug, pageSlug);
  const newVisibility = formData.get("visibility") as Visibility;
  const newSecretLevel = parseSecretLevel(formData.get("secretLevel"));
  const newRevealState = parseRevealState(formData.get("revealState"));

  await repo().updatePage(pageId, {
    title: String(formData.get("title")),
    slug: String(formData.get("slug")),
    type: formData.get("type") as PageType,
    summary: String(formData.get("summary") || "") || null,
    visibility: newVisibility,
    publishStatus: formData.get("publishStatus") as PublishStatus,
    canonicalStatus: formData.get("canonicalStatus") as CanonicalStatus,
    secretLevel: newSecretLevel,
    revealState: newRevealState,
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    aliases: String(formData.get("aliases") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });

  const newSlug = String(formData.get("slug"));
  const type = formData.get("type") as PageType;
  const category = navCategoryForPageType(type);
  const newHref = buildPageUrl(worldSlug, type, newSlug);
  const title = String(formData.get("title"));

  await activity().log({
    worldId: oldPage?.worldId,
    worldSlug,
    action: "content_updated",
    targetType: "page",
    targetId: pageId,
    targetLabel: title,
    targetHref: newHref,
    summary: `Seite „${title}“ geändert.`,
    details:
      oldPage &&
      (oldPage.secretLevel !== newSecretLevel || oldPage.revealState !== newRevealState)
        ? {
            secretLevel: { from: oldPage.secretLevel, to: newSecretLevel },
            revealState: { from: oldPage.revealState, to: newRevealState },
          }
        : undefined,
  });

  if (oldPage && oldPage.visibility !== newVisibility) {
    await activity().log({
      worldId: oldPage.worldId,
      worldSlug,
      action: "visibility_changed",
      targetType: "page",
      targetId: pageId,
      targetLabel: title,
      targetHref: newHref,
      summary: `Sichtbarkeit von „${title}“: ${oldPage.visibility} → ${newVisibility}.`,
      details: { from: oldPage.visibility, to: newVisibility },
    });
  }

  revalidatePath(`/worlds/${worldSlug}`);
  if (oldPage) {
    revalidatePath(buildPageUrl(worldSlug, oldPage.type, oldPage.slug));
  }
  revalidatePath(newHref);
  redirect(`/worlds/${worldSlug}/${category}/${newSlug}/edit?saved=1`);
}

export async function createPageAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);
  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const type = formData.get("type") as PageType;
  const title = String(formData.get("title"));
  const campaignId = String(formData.get("campaignId") || "") || null;
  const templateService = createPageTemplateService(prisma);
  const template = await templateService.getTemplate(
    String(formData.get("template") || "") || null,
  );

  // Slug is optional: derive it from the title and avoid collisions.
  let slug = String(formData.get("slug") || "").trim();
  if (!slug) {
    const existing = await repo().listPagesByWorld(worldSlug);
    slug = pickUniqueSlug(
      slugifyPageTitle(title),
      existing.map((page) => page.slug),
    );
  }

  const initialContent = String(formData.get("initialContent") || "");

  // With a template, the form's content textarea edits the first template
  // block; the remaining blocks (e.g. DM-only notes) come from the template.
  const contentBlocks: CreateContentBlockInput[] = template
    ? template.blocks.map((block, index) => ({
        type: block.type,
        sortOrder: index,
        visibility: block.visibility,
        content: index === 0 ? initialContent : block.content,
      }))
    : [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: initialContent,
        },
      ];

  const page = await repo().createPage({
    worldId: world.id,
    campaignId,
    title,
    slug,
    type,
    summary: String(formData.get("summary") || "") || null,
    visibility: (formData.get("visibility") as Visibility) ?? "dm_only",
    publishStatus: (formData.get("publishStatus") as PublishStatus) ?? "draft",
    canonicalStatus: (formData.get("canonicalStatus") as CanonicalStatus) ?? "draft",
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    contentBlocks,
  });

  const pageHref = buildPageUrl(worldSlug, type, slug);

  await activity().log({
    worldId: world.id,
    worldSlug,
    action: "content_created",
    targetType: "page",
    targetId: page.id,
    targetLabel: title,
    targetHref: pageHref,
    summary: `Seite „${title}“ erstellt.`,
  });

  if (template) {
    await templateService.recordTemplateUsed(template, {
      worldId: world.id,
      worldSlug,
      pageTitle: title,
      pageHref,
    });
  }

  const category = navCategoryForPageType(type);
  revalidatePath(`/worlds/${worldSlug}`);
  redirect(`/worlds/${worldSlug}/${category}/${slug}/edit`);
}

export async function updateContentBlockAction(formData: FormData) {
  await requireStudioActionAuth();
  const blockId = String(formData.get("blockId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));

  await requireStudioWorldEdit(worldSlug);

  const oldBlock = await prisma.contentBlock.findUnique({
    where: { id: blockId },
    include: { page: { select: { worldId: true, title: true } } },
  });
  if (!oldBlock) {
    throw new Error("Block nicht gefunden");
  }

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world || oldBlock.page.worldId !== world.id) {
    throw new Error("Block nicht gefunden");
  }

  const newVisibility = formData.get("visibility") as Visibility;

  await repo().updateContentBlock(blockId, {
    type: formData.get("type") as ContentBlockType,
    sortOrder: Number(formData.get("sortOrder")),
    content: String(formData.get("content") || ""),
    visibility: newVisibility,
  });

  const editHref = `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;

  if (oldBlock && oldBlock.visibility !== newVisibility) {
    await activity().log({
      worldId: oldBlock.page.worldId,
      worldSlug,
      action: "visibility_changed",
      targetType: "content_block",
      targetId: blockId,
      targetLabel: `Block auf „${oldBlock.page.title}“`,
      targetHref: editHref,
      summary: `Block-Sichtbarkeit auf „${oldBlock.page.title}“: ${oldBlock.visibility} → ${newVisibility}.`,
      details: { from: oldBlock.visibility, to: newVisibility },
    });
  }

  revalidatePath(editHref);
  redirect(`${editHref}?saved=1`);
}

export async function createContentBlockAction(formData: FormData) {
  await requireStudioActionAuth();
  const pageId = String(formData.get("pageId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));

  await requireStudioContentEdit(worldSlug, pageId);

  const page = await repo().getPageBySlug(worldSlug, pageSlug);
  const nextOrder = page?.contentBlocks.length ?? 0;

  await repo().createContentBlock(pageId, {
    type: (formData.get("type") as ContentBlockType) ?? "rich_text",
    sortOrder: nextOrder,
    content: String(formData.get("content") || ""),
    visibility: (formData.get("visibility") as Visibility) ?? "dm_only",
  });

  revalidatePath(`/worlds/${worldSlug}/${category}/${pageSlug}/edit`);
  redirect(`/worlds/${worldSlug}/${category}/${pageSlug}/edit?saved=1`);
}

export async function deleteContentBlockAction(formData: FormData) {
  await requireStudioActionAuth();
  const blockId = String(formData.get("blockId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));

  await requireStudioWorldEdit(worldSlug);

  // Snapshot before deleting so the block can be restored from the activity log.
  const block = await prisma.contentBlock.findUnique({
    where: { id: blockId },
    include: { page: { select: { worldId: true, title: true } } },
  });

  if (!block) {
    throw new Error("Block nicht gefunden");
  }

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world || block.page.worldId !== world.id) {
    throw new Error("Block nicht gefunden");
  }

  let undoEntryId: string | undefined;
  {
    const undoEntry = await createUndoService(prisma).captureBlock(blockId, "block.delete");
    undoEntryId = undoEntry.id;
  }

  await repo().deleteContentBlock(blockId);

  await activity().log({
      worldId: block.page.worldId,
      worldSlug,
      action: "content_deleted",
      targetType: "content_block",
      targetId: blockId,
      targetLabel: `Block auf „${block.page.title}“`,
      targetHref: `/worlds/${worldSlug}/${category}/${pageSlug}/edit`,
      summary: `Block (${block.type}) auf „${block.page.title}“ gelöscht.`,
      details: { blockType: block.type, visibility: block.visibility },
      undoEntryId,
    });

  revalidatePath(`/worlds/${worldSlug}/${category}/${pageSlug}/edit`);
  redirect(`/worlds/${worldSlug}/${category}/${pageSlug}/edit?saved=1`);
}

