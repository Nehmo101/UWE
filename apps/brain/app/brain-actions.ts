"use server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createMiniatureCollectionService,
  type CaptureStatus,
  type CaptureType,
  type MiniatureCollectionStatus,
} from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/* ══ Mail client: send (SMTP), sync (IMAP), read & message actions ═══ */

function mailPortal() {
  return createMailPortalService(brainPrisma);
}

function parseAddresses(formData: FormData, field = "to"): string[] {
  return str(formData.get(field))
    .split(/[,;\n]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function parsePort(value: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(str(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function addMailAccountAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const label = str(formData.get("label"));
  const smtpHost = str(formData.get("smtpHost"));
  const username = str(formData.get("username"));
  // Password is stored encrypted (encryptSecret); never trim (may be significant).
  const password = String(formData.get("password") ?? "");
  if (!label || !smtpHost || !username || !password) return;
  await mailPortal().createAccount(
    {
      label,
      smtpHost,
      smtpPort: parsePort(formData.get("smtpPort")),
      imapHost: str(formData.get("imapHost")) || null,
      imapPort: parsePort(formData.get("imapPort")),
      username,
      password,
      isDefault: str(formData.get("isDefault")) === "on",
    },
    owner.id,
  );
  revalidatePath("/mail");
}

export async function deleteMailAccountAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await mailPortal().deleteAccount(id, owner.id);
  revalidatePath("/mail");
}

export async function syncMailAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const service = mailPortal();
  const accountId = str(formData.get("accountId"));
  if (accountId && accountId !== "all") {
    await service.syncAccount(accountId, owner.id);
  } else {
    const accounts = await service.listAccounts();
    for (const account of accounts) {
      try {
        await service.syncAccount(account.id, owner.id);
      } catch {
        // One account failing must not abort the rest (errors are audit-logged).
      }
    }
  }
  revalidatePath("/mail");
}

export async function sendMailAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const accountId = str(formData.get("accountId"));
  const to = parseAddresses(formData, "to");
  if (!accountId) throw new Error("Bitte ein Absender-Konto wählen.");
  if (to.length === 0) throw new Error("Mindestens ein Empfänger ist erforderlich.");
  const result = await mailPortal().sendDirect(
    {
      accountId,
      to,
      cc: parseAddresses(formData, "cc"),
      subject: str(formData.get("subject")) || "(kein Betreff)",
      bodyText: str(formData.get("bodyText")),
    },
    owner.id,
  );
  if (!result.ok) {
    throw new Error(`Versand fehlgeschlagen: ${result.error ?? "unbekannter Fehler"}`);
  }
  const back = str(formData.get("returnTo"));
  revalidatePath("/mail");
  if (back) redirect(back);
}

export async function setMailReadAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const id = str(formData.get("id"));
  const read = str(formData.get("read")) !== "false";
  if (id) await mailPortal().setMessageRead(id, read, owner.id);
  revalidatePath("/mail");
}

export async function setMailStarredAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const id = str(formData.get("id"));
  const starred = str(formData.get("starred")) === "true";
  if (id) await mailPortal().setMessageStarred(id, starred, owner.id);
  revalidatePath("/mail");
}

export async function archiveMailAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await mailPortal().archiveMessage(id, owner.id);
  revalidatePath("/mail");
  redirect("/mail");
}

export async function trashMailAction(formData: FormData) {
  const owner = await requireBrainActionAuth();
  const id = str(formData.get("id"));
  if (id) await mailPortal().trashMessage(id, owner.id);
  revalidatePath("/mail");
  redirect("/mail");
}
