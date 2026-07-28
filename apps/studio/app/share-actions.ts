"use server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

import {
  prisma,
  createShareLinkService,
  type ShareTargetType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { revalidateWorldRootAndWiki } from "@/src/lib/world-revalidate";
import {
  assertStudioTrusted,
  requireStudioWorldEdit,
} from "@/src/lib/authz";

export async function createShareLinkAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldId = String(formData.get("worldId"));
  const worldSlug = String(formData.get("worldSlug"));
  const targetType = formData.get("targetType") as ShareTargetType;
  const targetId = String(formData.get("targetId"));
  const returnPath = String(formData.get("returnPath"));
  const expiresAtRaw = String(formData.get("expiresAt") || "");
  const password = String(formData.get("password") || "") || null;
  const readOnly = formData.get("readOnly") !== "off";
  const logAccess = formData.get("logAccess") === "on";

  await requireStudioWorldEdit(worldSlug);

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  await createShareLinkService(prisma).createShareLink({
    worldId,
    targetType,
    targetId,
    expiresAt,
    password,
    readOnly,
    logAccess,
  });

  revalidatePath(returnPath);
  revalidateWorldRootAndWiki(worldSlug);
}

export async function updateShareLinkAction(formData: FormData) {
  await requireStudioActionAuth();
  const linkId = String(formData.get("linkId"));
  const returnPath = String(formData.get("returnPath"));
  const worldSlug = returnPath.match(/^\/worlds\/([^/]+)/)?.[1];
  if (worldSlug) {
    await requireStudioWorldEdit(worldSlug);
  } else {
    assertStudioTrusted();
  }

  const expiresAtRaw = String(formData.get("expiresAt") || "");
  const password = String(formData.get("password") || "");
  const clearPassword = formData.get("clearPassword") === "on";
  const readOnly = formData.get("readOnly") !== "off";
  const logAccess = formData.get("logAccess") === "on";

  await createShareLinkService(prisma).updateShareLink(linkId, {
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
    password: password || undefined,
    clearPassword,
    readOnly,
    logAccess,
  });

  revalidatePath(returnPath);
}

export async function disableShareLinkAction(formData: FormData) {
  await requireStudioActionAuth();
  const linkId = String(formData.get("linkId"));
  const returnPath = String(formData.get("returnPath"));
  const worldSlug = returnPath.match(/^\/worlds\/([^/]+)/)?.[1];
  if (worldSlug) {
    await requireStudioWorldEdit(worldSlug);
  } else {
    assertStudioTrusted();
  }

  await createShareLinkService(prisma).disableShareLink(linkId);

  revalidatePath(returnPath);
}
