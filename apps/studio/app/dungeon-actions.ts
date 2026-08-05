"use server";

import { z } from "zod";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createDungeonCockpitService,
  createGameSessionService,
  createSessionLiveService,
  getAppRepository,
  prisma,
  ROOM_CHILD_TYPES,
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

const titleSchema = z.string().trim().min(1, "Titel ist erforderlich.");

/** Validate and normalize a required title field; throws a clear error. */
function parseTitle(formData: FormData): string {
  const result = titleSchema.safeParse(formData.get("title") ?? "");
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Ungültiger Titel.");
  }
  return result.data;
}

/** Validate the room child type against the known enum. */
function parseRoomChildType(formData: FormData): RoomChildType {
  const value = formData.get("childType");
  if (typeof value !== "string" || !ROOM_CHILD_TYPES.includes(value as RoomChildType)) {
    throw new Error("Ungültiger Raum-Inhaltstyp.");
  }
  return value as RoomChildType;
}

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
  if (!world) throw new Error("Welt nicht gefunden.");

  const title = parseTitle(formData);
  const campaignId = String(formData.get("campaignId") || "") || null;

  const dungeon = await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId,
    parentPageId: null,
    title,
    type: "dungeon",
    summary: String(formData.get("summary") || "") || null,
    prepStatus: "unprepared",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
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
  if (!dungeon || dungeon.type !== "dungeon") throw new Error("Dungeon nicht gefunden.");

  const title = parseTitle(formData);

  const level = await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId: dungeon.campaignId,
    parentPageId: dungeon.id,
    title,
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
  if (!levelOverview) throw new Error("Ebene nicht gefunden.");

  const title = parseTitle(formData);
  const dungeonPage = await repo().getPageBySlug(worldSlug, dungeonSlug);

  const room = await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId: dungeonPage?.campaignId ?? null,
    parentPageId: levelOverview.level.id,
    title,
    type: "room",
    prepStatus: (formData.get("prepStatus") as DungeonPrepStatus) ?? "unprepared",
    contentBlocks: [
      {
        type: "player_text",
        sortOrder: 0,
        content: String(formData.get("readAloud") || ""),
      },
      {
        type: "rich_text",
        sortOrder: 1,
        content: String(formData.get("playerDescription") || ""),
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

  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("Welt nicht gefunden.");

  const title = parseTitle(formData);
  const childType = parseRoomChildType(formData);

  const roomCockpit = await dungeons().getRoomCockpit(
    worldSlug,
    dungeonSlug,
    levelSlug,
    roomSlug,
    [],
  );
  if (!roomCockpit) throw new Error("Raum nicht gefunden.");

  const dungeonPage = await repo().getPageBySlug(worldSlug, dungeonSlug);

  await dungeons().createWithGeneratedSlug({
    worldId: world.id,
    campaignId: dungeonPage?.campaignId ?? null,
    parentPageId: roomCockpit.room.id,
    title,
    type: childType,
    summary: String(formData.get("summary") || "") || null,
    prepStatus: (formData.get("prepStatus") as DungeonPrepStatus) ?? "unprepared",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
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

  const readAloudContent = String(formData.get("readAloud") || "");
  const playerDescriptionContent = String(formData.get("playerDescription") || "");

  if (readAloud) {
    await repo().updateContentBlock(readAloud.id, { content: readAloudContent });
  } else {
    await repo().addContentBlock(roomId, {
      type: "player_text",
      sortOrder: 0,
      content: readAloudContent,
    });
  }

  if (playerDescription) {
    await repo().updateContentBlock(playerDescription.id, { content: playerDescriptionContent });
  } else {
    await repo().addContentBlock(roomId, {
      type: "rich_text",
      sortOrder: 1,
      content: playerDescriptionContent,
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

/**
 * Schnell-Protokoll vom Spieltisch: eine Notiz aus dem Raum-Cockpit direkt
 * ins Live-Protokoll der laufenden Session (refPageId = Raum). Leerer Text
 * wird zum „Raum betreten"-Marker.
 */
export async function logRoomToSessionAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const dungeonSlug = String(formData.get("dungeonSlug"));
  const levelSlug = String(formData.get("levelSlug"));
  const roomSlug = String(formData.get("roomSlug"));
  const sessionId = String(formData.get("sessionId"));
  const roomPageId = String(formData.get("roomPageId"));
  const content = String(formData.get("content") || "").trim();
  await requireStudioWorldEdit(worldSlug);

  const session = await createGameSessionService().getByIdForWorld(worldSlug, sessionId);
  if (!session) throw new Error("Session nicht gefunden.");
  const room = await prisma.page.findFirst({
    where: { id: roomPageId, world: { slug: worldSlug }, type: "room" },
    select: { title: true },
  });
  if (!room) throw new Error("Raum nicht gefunden.");

  await createSessionLiveService(prisma).appendEntry({
    gameSessionId: session.id,
    kind: "note",
    content: content || `Raum betreten: ${room.title}`,
    refPageId: roomPageId,
  });

  const roomPath = `${dungeonBasePath(worldSlug, dungeonSlug)}/ebenen/${levelSlug}/raeume/${roomSlug}`;
  revalidatePath(`/worlds/${worldSlug}/sessions/${session.id}/live`);
  revalidatePath(roomPath);
  redirect(`${roomPath}?logged=1`);
}
