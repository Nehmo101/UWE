"use server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { type LabelPrintFormat } from "@uwe/connector";
import {
  createConnectorService,
  createLabelPrintQueueService,
  createPrintListService,
  prisma,
  summarizePrintList,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";
import {
  hasQueueLabelPrintingConnector,
  LABEL_PRINT_QUEUE_UNAVAILABLE_MESSAGE,
} from "@/src/lib/label-print-availability";

export async function refreshPrintersAction(formData: FormData) {
  await requireStudioActionAuth();
  const user = await getCurrentAuthUser();
  if (!user) redirect("/login");
  const returnTo = String(formData.get("returnTo") || "/system/printers");
  if (!hasQueueLabelPrintingConnector(await createConnectorService(prisma).summarize())) {
    redirect(`${returnTo}?error=${encodeURIComponent(LABEL_PRINT_QUEUE_UNAVAILABLE_MESSAGE)}`);
  }
  await createLabelPrintQueueService().enqueuePrinterDiscover({ createdByUserId: user.id });
  revalidatePath("/system/printers");
  redirect(`${returnTo}?refreshed=1`);
}

export async function enqueueLabelPrintAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  const printListId = String(formData.get("printListId") || "");
  const printerKey = String(formData.get("printerKey") || "").trim();
  const [connectorId, printerId, ...nameParts] = printerKey.split("::");
  const returnTo = String(formData.get("returnTo") || "") || `/worlds/${worldSlug}/labels/print-lists/${printListId}`;
  if (!worldSlug || !printListId || !printerId) redirect(`${returnTo}?error=${encodeURIComponent("Drucker fehlt")}`);
  await requireStudioWorldEdit(worldSlug);
  const user = await getCurrentAuthUser();
  if (!user) redirect("/login");
  if (
    !hasQueueLabelPrintingConnector(
      await createConnectorService(prisma).summarize(),
      connectorId,
    )
  ) {
    redirect(`${returnTo}?error=${encodeURIComponent(LABEL_PRINT_QUEUE_UNAVAILABLE_MESSAGE)}`);
  }

  const list = await createPrintListService().getById(printListId);
  if (!list) redirect(`${returnTo}?error=${encodeURIComponent("Druckliste nicht gefunden.")}`);
  const summary = summarizePrintList(list);
  if (summary.hasDmOnly && formData.get("confirmDmOnlyBatch") !== "on") {
    redirect(`${returnTo}?error=${encodeURIComponent("DM-only Bestätigung fehlt.")}`);
  }

  try {
    await createLabelPrintQueueService().enqueuePrintList({
      worldSlug, printListId, printerId, printerName: nameParts.join("::") || undefined,
      format: (String(formData.get("format")) === "html" ? "html" : "pdf") as LabelPrintFormat,
      includeDmOnly: formData.get("includeDmOnly") === "on", targetConnectorId: connectorId || null, createdByUserId: user.id,
    });
  } catch (e) { redirect(`${returnTo}?error=${encodeURIComponent(e instanceof Error ? e.message : "Fehler")}`); }
  revalidatePath("/system/printers");
  revalidatePath(returnTo);
  redirect(`${returnTo}?queued=1`);
}
