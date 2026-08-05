"use server";

import { createCalendarService, prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { revalidatePath } from "next/cache";
import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";

/**
 * Fremde Kalender abonnieren — aus Family heraus.
 *
 * Bisher ging das nur über die Kalender-API von Studio. Wer nur Family nutzt,
 * konnte den Kalender der Schule oder des Vereins also gar nicht eintragen.
 *
 * Abos sind strukturell read-only: was von aussen kommt, wird hier nicht
 * geändert — eine Änderung würde beim nächsten Abgleich überschrieben.
 * Schreibbar ist nur der lokale Feed (auch über den CalDAV-Server fürs iPhone).
 */

function calendar() {
  return createCalendarService(familyPrisma, prisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function revalidateFeeds(): void {
  revalidatePath("/calendar");
  revalidatePath("/calendar/feeds");
}

export async function createFeedAction(formData: FormData) {
  await requireFamilyActionAuth();

  const name = str(formData.get("name"));
  const kind = str(formData.get("type"));
  if (!name) return;

  if (kind === "caldav") {
    const caldavUrl = str(formData.get("caldavUrl"));
    if (!caldavUrl) return;

    await calendar().createFeed({
      name,
      type: "caldav",
      caldavUrl,
      username: str(formData.get("username")) || null,
      password: str(formData.get("password")) || null,
      color: str(formData.get("color")) || null,
    });
  } else {
    const url = str(formData.get("url"));
    if (!url) return;

    await calendar().createFeed({
      name,
      type: "ical_url",
      url,
      color: str(formData.get("color")) || null,
    });
  }

  revalidateFeeds();
}

export async function toggleFeedAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = str(formData.get("id"));
  if (!id) return;

  await calendar().updateFeed(id, { enabled: str(formData.get("enabled")) === "on" });
  revalidateFeeds();
}

export async function deleteFeedAction(formData: FormData) {
  await requireFamilyActionAuth();

  const id = str(formData.get("id"));
  if (!id) return;

  // Der lokale Feed ist die Heimat aller eigenen Termine — ihn zu loeschen
  // wuerde sie heimatlos machen.
  const feed = await familyPrisma.calendarFeed.findUnique({
    where: { id },
    select: { type: true },
  });
  if (!feed || feed.type === "local") return;

  await calendar().deleteFeed(id);
  revalidateFeeds();
}
