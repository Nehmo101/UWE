"use server";

import {
  createPrismaClient,
  createShareLinkService,
  type ShareTargetType,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";

export async function createShareLinkAction(formData: FormData) {
  const worldId = String(formData.get("worldId"));
  const worldSlug = String(formData.get("worldSlug"));
  const targetType = formData.get("targetType") as ShareTargetType;
  const targetId = String(formData.get("targetId"));
  const returnPath = String(formData.get("returnPath"));
  const expiresAtRaw = String(formData.get("expiresAt") || "");
  const password = String(formData.get("password") || "") || null;
  const readOnly = formData.get("readOnly") !== "off";
  const logAccess = formData.get("logAccess") === "on";

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  const db = createPrismaClient();
  try {
    await createShareLinkService(db).createShareLink({
      worldId,
      targetType,
      targetId,
      expiresAt,
      password,
      readOnly,
      logAccess,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnPath);
  revalidatePath(`/worlds/${worldSlug}`);
}

export async function updateShareLinkAction(formData: FormData) {
  const linkId = String(formData.get("linkId"));
  const returnPath = String(formData.get("returnPath"));
  const expiresAtRaw = String(formData.get("expiresAt") || "");
  const password = String(formData.get("password") || "");
  const clearPassword = formData.get("clearPassword") === "on";
  const readOnly = formData.get("readOnly") !== "off";
  const logAccess = formData.get("logAccess") === "on";

  const db = createPrismaClient();
  try {
    await createShareLinkService(db).updateShareLink(linkId, {
      expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
      password: password || undefined,
      clearPassword,
      readOnly,
      logAccess,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnPath);
}

export async function disableShareLinkAction(formData: FormData) {
  const linkId = String(formData.get("linkId"));
  const returnPath = String(formData.get("returnPath"));

  const db = createPrismaClient();
  try {
    await createShareLinkService(db).disableShareLink(linkId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnPath);
}
