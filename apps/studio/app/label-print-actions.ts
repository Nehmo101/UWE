"use server";
import { capabilityOfflineMessage, type LabelPrintFormat } from "@uwe/connector";
import { createConnectorService, createLabelPrintQueueService, prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

export async function refreshPrintersAction(formData: FormData) {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/login");
  const returnTo = String(formData.get("returnTo") || "/system/printers");
  if (!(await createConnectorService(prisma).summarize()).availableCapabilities.includes("label_printing")) {
    redirect(`${returnTo}?error=${encodeURIComponent(capabilityOfflineMessage("label_printing"))}`);
  }
  await createLabelPrintQueueService().enqueuePrinterDiscover({ createdByUserId: user.id });
  revalidatePath("/system/printers");
  redirect(`${returnTo}?refreshed=1`);
}

export async function enqueueLabelPrintAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug") || "");
  const printListId = String(formData.get("printListId") || "");
  const printerKey = String(formData.get("printerKey") || "").trim();
  const [connectorId, printerId, ...nameParts] = printerKey.split("::");
  const returnTo = String(formData.get("returnTo") || "") || `/worlds/${worldSlug}/labels/print-lists/${printListId}`;
  if (!worldSlug || !printListId || !printerId) redirect(`${returnTo}?error=${encodeURIComponent("Drucker fehlt")}`);
  await requireStudioWorldEdit(worldSlug);
  const user = await getCurrentAuthUser();
  if (!user) redirect("/login");
  if (!(await createConnectorService(prisma).summarize()).availableCapabilities.includes("label_printing")) {
    redirect(`${returnTo}?error=${encodeURIComponent(capabilityOfflineMessage("label_printing"))}`);
  }
  try {
    await createLabelPrintQueueService().enqueuePrintList({
      worldSlug, printListId, printerId, printerName: nameParts.join("::") || undefined,
      format: (String(formData.get("format")) === "html" ? "html" : "pdf") as LabelPrintFormat,
      includeDmOnly: formData.get("includeDmOnly") === "on", targetConnectorId: connectorId || null, createdByUserId: user.id,
    });
  } catch (e) { redirect(`${returnTo}?error=${encodeURIComponent(e instanceof Error ? e.message : "Fehler")}`); }
  revalidatePath("/system/printers");
  redirect(`${returnTo}?queued=1`);
}
