import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createDungeonCockpitService,
  getAppRepository,
  type DungeonPrepStatus,
  type RoomChildType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireStudioAssetEdit,
  requireStudioContentEdit,
  requireStudioWorldEdit,
} from "@/src/lib/authz";

function dungeons() {
  return createDungeonCockpitService();
}

function repo() {
  return getAppRepository();
}

function dungeonBasePath(worldSlug: string, dungeonSlug: string) {
  return `/worlds/${worldSlug}/dungeons/${dungeonSlug}`;
}

export async function createDungeonAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const campaignId = String(formData.get("campaignId") || "") || null;

  const dungeon = await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId,
    parentPageId: null,
    title: String(formData.get("title")),
    type: "dungeon",
    summary: String(formData.get("summary") || "") || null,
    prepStatus: "unprepared",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "dm_only",
        content: String(formData.get("description") || ""),
      },
    ],
  });

  revalidatePath(`/worlds/${worldSlug}/dungeons`);
  redirect(`/worlds/${worldSlug}/dungeons/${dungeon.slug}`);
}

export async function createDungeonLevelAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const dungeonSlug = String(formData.get("dungeonSlug"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const dungeon = await repo().getPageBySlug(worldSlug, dungeonSlug);
  if (!dungeon || dungeon.type !== "dungeon") throw new Error("Dungeon not found");

  const level = await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId: dungeon.campaignId,
    parentPageId: dungeon.id,
    title: String(formData.get("title")),
    type: "dungeon_level",
    prepStatus: (formData.get("prepStatus") as DungeonPrepStatus) ?? "unprepared",
  });

  revalidatePath(dungeonBasePath(worldSlug, dungeonSlug));
  redirect(`${dungeonBasePath(worldSlug, dungeonSlug)}/ebenen/${level.slug}?created=1`);
}

export async function createDungeonRoomAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const dungeonSlug = String(formData.get("dungeonSlug"));
  const levelSlug = String(formData.get("levelSlug"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const levelOverview = await dungeons().getLevelOverview(worldSlug, dungeonSlug, levelSlug);
  if (!levelOverview) throw new Error("Level not found");

  const dungeonPage = await repo().getPageBySlug(worldSlug, dungeonSlug);

  const room = await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId: dungeonPage?.campaignId ?? null,
    parentPageId: levelOverview.level.id,
    title: String(formData.get("title")),
    type: "room",
    prepStatus: (formData.get("prepStatus") as DungeonPrepStatus) ?? "unprepared",
    contentBlocks: [
      {
        type: "player_text",
        sortOrder: 0,
        visibility: "player_visible",
        content: String(formData.get("readAloud") || ""),
      },
      {
        type: "rich_text",
        sortOrder: 1,
        visibility: "player_visible",
        content: String(formData.get("playerDescription") || ""),
      },
      {
        type: "gm_note",
        sortOrder: 2,
        visibility: "dm_only",
        content: String(formData.get("dmNotes") || ""),
      },
    ],
  });

  revalidatePath(`${dungeonBasePath(worldSlug, dungeonSlug)}/ebenen/${levelSlug}`);
  redirect(
    `${dungeonBasePath(worldSlug, dungeonSlug)}/ebenen/${levelSlug}/raeume/${room.slug}?created=1`,
  );
}

export async function createRoomChildAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const dungeonSlug = String(formData.get("dungeonSlug"));
  const levelSlug = String(formData.get("levelSlug"));
  const roomSlug = String(formData.get("roomSlug"));
  const childType = formData.get("childType") as RoomChildType;

  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const roomCockpit = await dungeons().getRoomCockpit(
    worldSlug,
    dungeonSlug,
    levelSlug,
    roomSlug,
    [],
  );
  if (!roomCockpit) throw new Error("Room not found");

  const dungeonPage = await repo().getPageBySlug(worldSlug, dungeonSlug);

  await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId: dungeonPage?.campaignId ?? null,
    parentPageId: roomCockpit.room.id,
    title: String(formData.get("title")),
    type: childType,
    summary: String(formData.get("summary") || "") || null,
    prepStatus: (formData.get("prepStatus") as DungeonPrepStatus) ?? "unprepared",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "dm_only",
        content: String(formData.get("content") || ""),
      },
    ],
  });

  revalidatePath(
    `${dungeonBasePath(worldSlug, dungeonSlug)}/ebenen/${levelSlug}/raeume/${roomSlug}`,
  );
  redirect(
    `${dungeonBasePath(worldSlug, dungeonSlug)}/ebenen/${levelSlug}/raeume/${roomSlug}?added=1`,
  );
}

export async function updateDungeonEntityAction(formData: FormData) {
  await requireStudioActionAuth();
  const pageId = String(formData.get("pageId"));
  const redirectTo = String(formData.get("redirectTo"));
  const worldSlug = redirectTo.split("/")[2];
  if (!worldSlug) throw new Error("World not found");

  await requireStudioContentEdit(worldSlug, pageId);

  await dungeons().updateEntity(pageId, {
    title: String(formData.get("title")),
    prepStatus: formData.get("prepStatus") as DungeonPrepStatus,
    summary: String(formData.get("summary") || "") || null,
    visibility: formData.get("visibility") as import("@uwe/database/server").Visibility,
    publishStatus: formData.get("publishStatus") as import("@uwe/database/server").PublishStatus,
  });

  revalidatePath(redirectTo);
  redirect(`${redirectTo}?saved=1`);
}

export async function linkAssetToDungeonPageAction(formData: FormData) {
  await requireStudioActionAuth();
  const pageId = String(formData.get("pageId"));
  const assetId = String(formData.get("assetId"));
  const redirectTo = String(formData.get("redirectTo"));
  const worldSlug = redirectTo.split("/")[2];
  if (!worldSlug) throw new Error("World not found");

  await requireStudioContentEdit(worldSlug, pageId);
  await requireStudioAssetEdit(worldSlug, assetId);

  await dungeons().linkAsset(pageId, assetId);

  revalidatePath(redirectTo);
  redirect(`${redirectTo}?assetLinked=1`);
}

export async function updateRoomContentAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const dungeonSlug = String(formData.get("dungeonSlug"));
  const levelSlug = String(formData.get("levelSlug"));
  const roomSlug = String(formData.get("roomSlug"));
  const roomId = String(formData.get("roomId"));

  await requireStudioContentEdit(worldSlug, roomId);

  const page = await repo().getPageById(roomId);
  if (!page) throw new Error("Room not found");

  const blocks = [...page.contentBlocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const readAloud = blocks.find((b) => b.type === "player_text" && b.sortOrder === 0);
  const playerDescription = blocks.find((b) => b.type === "rich_text" && b.sortOrder === 1);
  const dmNotes = blocks.find((b) => b.type === "gm_note" && b.sortOrder === 2);

  const readAloudContent = String(formData.get("readAloud") || "");
  const playerDescriptionContent = String(formData.get("playerDescription") || "");
  const dmNotesContent = String(formData.get("dmNotes") || "");

  if (readAloud) {
    await repo().updateContentBlock(readAloud.id, { content: readAloudContent });
  } else {
    await repo().addContentBlock(roomId, {
      type: "player_text",
      sortOrder: 0,
      content: readAloudContent,
      visibility: "player_visible",
    });
  }

  if (playerDescription) {
    await repo().updateContentBlock(playerDescription.id, { content: playerDescriptionContent });
  } else {
    await repo().addContentBlock(roomId, {
      type: "rich_text",
      sortOrder: 1,
      content: playerDescriptionContent,
      visibility: "player_visible",
    });
  }

  if (dmNotes) {
    await repo().updateContentBlock(dmNotes.id, { content: dmNotesContent });
  } else {
    await repo().addContentBlock(roomId, {
      type: "gm_note",
      sortOrder: 2,
      content: dmNotesContent,
      visibility: "dm_only",
    });
  }

  await dungeons().updateEntity(roomId, {
    title: String(formData.get("title")),
    prepStatus: formData.get("prepStatus") as DungeonPrepStatus,
  });

  const redirectTo = `${dungeonBasePath(worldSlug, dungeonSlug)}/ebenen/${levelSlug}/raeume/${roomSlug}`;
  revalidatePath(redirectTo);
  redirect(`${redirectTo}?saved=1`);
}
