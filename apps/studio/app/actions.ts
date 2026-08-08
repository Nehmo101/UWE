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
  type CreateContentBlockInput,
  type PageType,
  type CanonicalStatus,
  type ContentBlockType,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { revalidatePath } from "next/cache";
import { revalidateWorldRootAndWiki } from "@/src/lib/world-revalidate";
import { redirect } from "next/navigation";
import { requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";
import { decideContentBlockDelete } from "@/src/lib/content-block-delete";

function repo() {
  return getAppRepository();
}

function activity() {
  return createActivityLogService(prisma);
}

export async function updatePageAction(formData: FormData) {
  await requireStudioActionAuth();
  const pageId = String(formData.get("pageId"));
  const worldSlug = String(formData.get("worldSlug"));
  const pageSlug = String(formData.get("pageSlug"));

  await requireStudioContentEdit(worldSlug, pageId);

  // Capture old type/slug before the update so both old and new URLs are revalidated.
  const oldPage = await repo().getPageBySlug(worldSlug, pageSlug);

  await repo().updatePage(pageId, {
    title: String(formData.get("title")),
    slug: String(formData.get("slug")),
    type: formData.get("type") as PageType,
    summary: String(formData.get("summary") || "") || null,
    canonicalStatus: formData.get("canonicalStatus") as CanonicalStatus,
    // Ein nicht angehaktes Kontrollkaestchen schickt gar nichts — deshalb die
    // ausdrueckliche Pruefung auf "on" statt auf Anwesenheit.
    portalReleased: formData.get("portalReleased") === "on",
    tags: String(formData.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    aliases: String(formData.get("aliases") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });

  // „Seite speichern" speichert die Blöcke mit: das Bearbeiten-Formular trägt
  // die Blockfelder mit `blocks.<id>.`-Präfix. Nur Blöcke, die wirklich zu
  // dieser Seite gehören, werden angefasst — fremde IDs im FormData laufen leer.
  if (oldPage && oldPage.id === pageId) {
    for (const block of oldPage.contentBlocks) {
      const typeValue = formData.get(`blocks.${block.id}.type`);
      if (typeValue === null) continue;

      const newType = typeValue as ContentBlockType;
      // Nur Bild-Blöcke verweisen auf ein Asset; beim Wechsel weg vom Bild-Typ
      // wird die Verknüpfung wieder gelöst.
      const assetId =
        newType === "image"
          ? String(formData.get(`blocks.${block.id}.assetId`) || "") || null
          : null;

      await repo().updateContentBlock(block.id, {
        type: newType,
        sortOrder: block.sortOrder,
        content: String(formData.get(`blocks.${block.id}.content`) || ""),
        assetId,
      });
    }
  }

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
  });

  revalidateWorldRootAndWiki(worldSlug);
  if (oldPage) {
    revalidatePath(buildPageUrl(worldSlug, oldPage.type, oldPage.slug));
  }
  revalidatePath(newHref);

  // „Speichern & zur Ansicht" springt direkt in den Ansichtsmodus zurück;
  // die Seitenansicht zeigt über `?saved=1` dieselbe Erfolgsmeldung.
  if (String(formData.get("returnTo") || "") === "view") {
    redirect(`${newHref}?saved=1`);
  }
  redirect(`/worlds/${worldSlug}/${category}/${newSlug}/edit?saved=1`);
}

/**
 * Portal-Freigabe einer Seite direkt umschalten — aus dem Ansichtsmodus oder
 * der Wiki-Seitenliste, ohne den Bearbeitungsmodus zu öffnen.
 */
export async function setPagePortalReleasedAction(
  worldSlug: string,
  pageId: string,
  released: boolean,
): Promise<{ ok: boolean; message: string }> {
  await requireStudioActionAuth();
  await requireStudioContentEdit(worldSlug, pageId);

  const page = await repo().getPageById(pageId);
  if (!page) {
    return { ok: false, message: "Seite nicht gefunden." };
  }

  await repo().updatePage(pageId, { portalReleased: released });

  const pageHref = buildPageUrl(worldSlug, page.type, page.slug);

  await activity().log({
    worldId: page.worldId,
    worldSlug,
    action: "content_updated",
    targetType: "page",
    targetId: pageId,
    targetLabel: page.title,
    targetHref: pageHref,
    summary: released
      ? `Seite „${page.title}“ fürs Spieler-Wiki freigegeben.`
      : `Portal-Freigabe für „${page.title}“ entfernt.`,
  });

  revalidateWorldRootAndWiki(worldSlug);
  revalidatePath(pageHref);

  return {
    ok: true,
    message: released
      ? "Seite ist jetzt im Spieler-Wiki sichtbar."
      : "Seite ist nicht mehr im Spieler-Wiki sichtbar.",
  };
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
        content: index === 0 ? initialContent : block.content,
      }))
    : [
        {
          type: "rich_text",
          sortOrder: 0,
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
  revalidateWorldRootAndWiki(worldSlug);
  redirect(`/worlds/${worldSlug}/${category}/${slug}/edit`);
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

  const newType = (formData.get("type") as ContentBlockType) ?? "rich_text";
  const assetId =
    newType === "image" ? String(formData.get("assetId") || "") || null : null;

  await repo().createContentBlock(pageId, {
    type: newType,
    sortOrder: nextOrder,
    content: String(formData.get("content") || ""),
    assetId,
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

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Block nicht gefunden");
  }

  const decision = decideContentBlockDelete(block?.page.worldId ?? null, world.id);
  if (decision === "already_deleted") {
    revalidatePath(`/worlds/${worldSlug}/${category}/${pageSlug}/edit`);
    redirect(`/worlds/${worldSlug}/${category}/${pageSlug}/edit?deleted=already`);
  }
  if (decision === "not_found" || !block) {
    throw new Error("Block nicht gefunden");
  }

  let undoEntryId: string | undefined;
  {
    const undoEntry = await createUndoService(brainPrisma, prisma).captureBlock(blockId, "block.delete");
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
      details: { blockType: block.type },
      undoEntryId,
    });

  revalidatePath(`/worlds/${worldSlug}/${category}/${pageSlug}/edit`);
  redirect(`/worlds/${worldSlug}/${category}/${pageSlug}/edit?deleted=1`);
}

