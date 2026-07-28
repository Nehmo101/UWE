"use server";

import {
  createCalendarService,
  prisma,
  type CalendarEventKind,
} from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { revalidatePath } from "next/cache";
import { requireFamilyActionAuth } from "@/src/lib/family-action-auth";

/**
 * Kalender-Termine (H11).
 *
 * Nur eigene Termine sind schreibbar. Alles, was an einem Feed hängt, kommt aus
 * einer fremden Quelle (CalDAV, iCal, FamilyWall) und wird hier ausschließlich
 * angezeigt — eine Änderung würde beim nächsten Sync überschrieben.
 */

function calendar() {
  return createCalendarService(familyPrisma, prisma);
}

function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function dateOrNull(value: FormDataEntryValue | null): Date | null {
  const raw = str(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function kindOf(value: FormDataEntryValue | null): CalendarEventKind {
  const raw = str(value);
  return raw === "session" || raw === "prep" || raw === "dnd" ? raw : "personal";
}

function revalidateCalendar(): void {
  revalidatePath("/calendar");
  revalidatePath("/");
}

/** Ein Termin ohne Feed ist unser eigener; nur den darf Family ändern. */
async function assertLocalEvent(id: string): Promise<boolean> {
  const event = await familyPrisma.calendarEvent.findUnique({
    where: { id },
    select: { feedId: true, feed: { select: { type: true } } },
  });
  if (!event) return false;
  return event.feedId === null || event.feed?.type === "local";
}

export async function createEventAction(formData: FormData) {
  await requireFamilyActionAuth();
  const title = str(formData.get("title"));
  const startAt = dateOrNull(formData.get("startAt"));
  if (!title || !startAt) return;

  const service = calendar();
  // Ohne lokalen Feed hätte der Termin keine Heimat und würde aus jeder
  // Feed-gefilterten Ansicht fallen.
  const local = await service.ensureLocalFeed();
  await service.createEvent({
    feedId: local.id,
    title,
    description: str(formData.get("description")) || null,
    location: str(formData.get("location")) || null,
    startAt,
    endAt: dateOrNull(formData.get("endAt")),
    allDay: str(formData.get("allDay")) === "on",
    kind: kindOf(formData.get("kind")),
  });
  revalidateCalendar();
}

export async function updateEventAction(formData: FormData) {
  await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  const startAt = dateOrNull(formData.get("startAt"));
  if (!id || !title || !startAt) return;
  if (!(await assertLocalEvent(id))) return;

  await calendar().updateEvent(id, {
    title,
    description: str(formData.get("description")) || null,
    location: str(formData.get("location")) || null,
    startAt,
    endAt: dateOrNull(formData.get("endAt")),
    allDay: str(formData.get("allDay")) === "on",
    kind: kindOf(formData.get("kind")),
  });
  revalidateCalendar();
}

export async function deleteEventAction(formData: FormData) {
  await requireFamilyActionAuth();
  const id = str(formData.get("id"));
  if (!id) return;
  if (!(await assertLocalEvent(id))) return;

  await calendar().deleteEvent(id);
  revalidateCalendar();
}
