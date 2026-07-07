"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { BringApiError, createBringService } from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function bring() {
  return createBringService(prisma);
}

const SHOPPING_PATH = "/kitchen/shopping";

/** Baut ein Redirect-Ziel mit optionaler Liste und Status-Flag. */
function shoppingRedirect(
  listId: string | null,
  flag: { bring: "ok" | "error"; msg?: string },
): string {
  const params = new URLSearchParams();
  if (listId) params.set("list", listId);
  params.set("bring", flag.bring);
  if (flag.msg) params.set("msg", flag.msg);
  return `${SHOPPING_PATH}?${params.toString()}`;
}

/** Wandelt einen Fehler in eine für den Nutzer lesbare Kurzmeldung. */
function toMessage(error: unknown): string {
  if (error instanceof BringApiError || error instanceof Error) {
    return error.message;
  }
  return "Unbekannter Fehler bei der Bring!-Verbindung.";
}

export async function connectBringAction(formData: FormData) {
  await requireStudioActionAuth();

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let target: string;
  try {
    await bring().connect(email, password);
    target = shoppingRedirect(null, { bring: "ok" });
  } catch (error) {
    target = shoppingRedirect(null, { bring: "error", msg: toMessage(error) });
  }

  revalidatePath(SHOPPING_PATH);
  redirect(target);
}

export async function disconnectBringAction() {
  await requireStudioActionAuth();
  await bring().disconnect();
  revalidatePath(SHOPPING_PATH);
  redirect(shoppingRedirect(null, { bring: "ok" }));
}

export async function refreshBringListsAction() {
  await requireStudioActionAuth();

  let target: string;
  try {
    await bring().refreshLists();
    target = shoppingRedirect(null, { bring: "ok" });
  } catch (error) {
    target = shoppingRedirect(null, { bring: "error", msg: toMessage(error) });
  }

  revalidatePath(SHOPPING_PATH);
  redirect(target);
}

export async function setBringListAction(formData: FormData) {
  await requireStudioActionAuth();

  const listUuid = String(formData.get("listUuid") ?? "").trim();
  let target: string;
  try {
    if (!listUuid) throw new Error("Keine Liste gewählt.");
    await bring().setDefaultList(listUuid);
    target = shoppingRedirect(null, { bring: "ok" });
  } catch (error) {
    target = shoppingRedirect(null, { bring: "error", msg: toMessage(error) });
  }

  revalidatePath(SHOPPING_PATH);
  redirect(target);
}

export async function syncListWithBringAction(formData: FormData) {
  await requireStudioActionAuth();

  const listId = String(formData.get("listId") ?? "").trim() || null;
  let target: string;
  try {
    if (!listId) throw new Error("Keine Einkaufsliste angegeben.");
    const summary = await bring().syncShoppingList(listId);
    const parts = [
      `${summary.addedToUwe} aus „${summary.listName}" übernommen`,
      `${summary.pushedToBring} gesendet`,
    ];
    if (summary.pushFailed > 0) parts.push(`${summary.pushFailed} fehlgeschlagen`);
    target = shoppingRedirect(listId, {
      bring: summary.pushFailed > 0 ? "error" : "ok",
      msg: "Abgeglichen: " + parts.join(", ") + ".",
    });
  } catch (error) {
    target = shoppingRedirect(listId, { bring: "error", msg: toMessage(error) });
  }

  revalidatePath(SHOPPING_PATH);
  redirect(target);
}

export async function pushListToBringAction(formData: FormData) {
  await requireStudioActionAuth();

  const listId = String(formData.get("listId") ?? "").trim() || null;
  let target: string;
  try {
    if (!listId) throw new Error("Keine Einkaufsliste angegeben.");
    const summary = await bring().pushShoppingList(listId);
    const parts = [`${summary.pushed} an „${summary.listName}" gesendet`];
    if (summary.failed > 0) parts.push(`${summary.failed} fehlgeschlagen`);
    if (summary.skipped > 0) parts.push(`${summary.skipped} bereits abgehakt`);
    target = shoppingRedirect(listId, {
      bring: summary.failed > 0 ? "error" : "ok",
      msg: parts.join(", ") + ".",
    });
  } catch (error) {
    target = shoppingRedirect(listId, { bring: "error", msg: toMessage(error) });
  }

  revalidatePath(SHOPPING_PATH);
  redirect(target);
}
