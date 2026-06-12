import {
  getAppRepository,
  getPageTemplate,
  navCategoryForPageType,
  buildPageUrl,
  pickUniqueSlug,
  slugifyPageTitle,
  type CreateContentBlockInput,
  type PageType,
  type Visibility,
  type PublishStatus,
  type CanonicalStatus,
  type ContentBlockType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function repo() {
  return getAppRepository();
}

export async function updatePageAction(formData: FormData) {
  const pageId = String(formData.get("pageId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));

  await repo().updatePage(pageId, {
    title: String(formData.get("title")),
    slug: String(formData.get("slug")),
    type: formData.get("type") as PageType,
    summary: String(formData.get("summary") || "") || null,
    visibility: formData.get("visibility") as Visibility,
    publishStatus: formData.get("publishStatus") as PublishStatus,
    canonicalStatus: formData.get("canonicalStatus") as CanonicalStatus,
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

  revalidatePath(`/worlds/${worldSlug}`);
  revalidatePath(`/worlds/${worldSlug}/${category}/${pageSlug}`);
  redirect(`/worlds/${worldSlug}/${category}/${newSlug}/edit?saved=1`);
}

export async function createPageAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const type = formData.get("type") as PageType;
  const title = String(formData.get("title"));
  const campaignId = String(formData.get("campaignId") || "") || null;
  const template = getPageTemplate(String(formData.get("template") || "") || null);

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

  await repo().createPage({
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

  const category = navCategoryForPageType(type);
  revalidatePath(`/worlds/${worldSlug}`);
  redirect(`/worlds/${worldSlug}/${category}/${slug}/edit`);
}

export async function updateContentBlockAction(formData: FormData) {
  const blockId = String(formData.get("blockId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));

  await repo().updateContentBlock(blockId, {
    type: formData.get("type") as ContentBlockType,
    sortOrder: Number(formData.get("sortOrder")),
    content: String(formData.get("content") || ""),
    visibility: formData.get("visibility") as Visibility,
  });

  revalidatePath(`/worlds/${worldSlug}/${category}/${pageSlug}/edit`);
  redirect(`/worlds/${worldSlug}/${category}/${pageSlug}/edit?saved=1`);
}

export async function createContentBlockAction(formData: FormData) {
  const pageId = String(formData.get("pageId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));

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
  const blockId = String(formData.get("blockId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));
  const category = String(formData.get("category"));

  await repo().deleteContentBlock(blockId);

  revalidatePath(`/worlds/${worldSlug}/${category}/${pageSlug}/edit`);
  redirect(`/worlds/${worldSlug}/${category}/${pageSlug}/edit?saved=1`);
}

export function pageEditHref(worldSlug: string, type: PageType, slug: string) {
  return `${buildPageUrl(worldSlug, type, slug)}/edit`;
}

export function pagePreviewHref(worldSlug: string, type: PageType, slug: string) {
  return `${buildPageUrl(worldSlug, type, slug)}?preview=player`;
}
