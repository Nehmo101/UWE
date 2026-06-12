import {
  createGameSessionService,
  getAppRepository,
  type GameSessionStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function sessions() {
  return createGameSessionService();
}

function repo() {
  return getAppRepository();
}

export async function createGameSessionAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const campaignSlug = String(formData.get("campaignSlug") || "");
  const campaign = campaignSlug
    ? await repo().getCampaignBySlug(worldSlug, campaignSlug)
    : null;

  const sessionNumber = await sessions().getNextSessionNumber(
    world.id,
    campaign?.id ?? null,
  );

  const session = await sessions().create({
    worldId: world.id,
    campaignId: campaign?.id ?? null,
    title: String(formData.get("title")),
    sessionNumber,
    date: formData.get("date") ? new Date(String(formData.get("date"))) : null,
    status: (formData.get("status") as GameSessionStatus) ?? "planned",
    summaryDm: String(formData.get("summaryDm") || "") || null,
    summaryPlayer: String(formData.get("summaryPlayer") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    openPlots: String(formData.get("openPlots") || "") || null,
    playerDecisions: String(formData.get("playerDecisions") || "") || null,
  });

  revalidatePath(`/worlds/${worldSlug}/sessions`);
  redirect(`/worlds/${worldSlug}/sessions/${session.id}`);
}

export async function updateGameSessionAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));

  // Page links are managed via dedicated link/unlink actions; only overwrite
  // them when the form explicitly submits the field.
  const linkedPageIds = formData.has("linkedPageIds")
    ? String(formData.get("linkedPageIds") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined;

  await sessions().update(sessionId, {
    title: String(formData.get("title")),
    sessionNumber: Number(formData.get("sessionNumber")),
    date: formData.get("date") ? new Date(String(formData.get("date"))) : null,
    status: formData.get("status") as GameSessionStatus,
    summaryDm: String(formData.get("summaryDm") || "") || null,
    summaryPlayer: String(formData.get("summaryPlayer") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    openPlots: String(formData.get("openPlots") || "") || null,
    playerDecisions: String(formData.get("playerDecisions") || "") || null,
    linkedPageIds,
  });

  revalidatePath(`/worlds/${worldSlug}/sessions`);
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?saved=1`);
}

export async function publishSessionRecapAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));

  await sessions().publishRecap(sessionId);

  revalidatePath(`/worlds/${worldSlug}/sessions`);
  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  revalidatePath(`/auth/worlds/${worldSlug}/sessions`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?published=1`);
}

export async function linkPageToSessionAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));
  const pageId = String(formData.get("pageId"));

  await sessions().linkPage(sessionId, pageId);

  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?linked=1`);
}

export async function unlinkPageFromSessionAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));
  const pageId = String(formData.get("pageId"));

  await sessions().unlinkPage(sessionId, pageId);

  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/sessions/${sessionId}?unlinked=1`);
}
