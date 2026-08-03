/**
 * Tagesstand des Haushalts — der Blick, den ein Küchen-Tablet braucht.
 *
 * Das Wochenbriefing (`briefing-service.ts`) beantwortet „was steht diese Woche
 * an"; hier geht es um „was ist heute". Beides speist sich aus demselben
 * gepflegten Bestand — Kalender, Mitglieder, Essensplan, Einkaufsliste,
 * Wartungsaufgaben, Gesundheitsakte — und beides speichert nichts: der Tag wird
 * bei jedem Abruf neu ausgerechnet.
 *
 * Die Formung (`buildFamilyDayBrief`) ist rein und getestet; nur das Einsammeln
 * (`loadFamilyDayBrief`) fasst die Datenbank an. Der Kalender-Dienst kommt als
 * Parameter herein statt als Import: er lebt im eingefrorenen
 * `@uwe/database/server`-Barrel und braucht beide Prisma-Clients.
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { createMealPlanService, createShoppingService, isoWeekOf } from "@uwe/kitchen";
import { expandAnniversaries, type AnniversaryKind } from "./anniversaries";
import { attachMembersToEvents } from "./event-members";
import type { FamilyHealthRecordKind } from "./family-types";
import { resolveMemberColour } from "./member-colours";
import { createFamilyMemberService } from "./member-service";

/** Höchstzahl offener Einkaufspositionen in der Antwort — ein Tablet zeigt keine 200. */
const DEFAULT_SHOPPING_ITEM_LIMIT = 40;

/** Wie viele Tage der Blick umfasst: heute, oder heute und morgen. */
export const FAMILY_DAY_BRIEF_MAX_DAYS = 2;

export interface FamilyDayBriefMember {
  id: string;
  displayName: string;
  colour: string;
}

export interface FamilyDayBriefEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  location: string | null;
  /** Leer heisst: betrifft den ganzen Haushalt. */
  memberIds: readonly string[];
  memberNames: readonly string[];
}

export interface FamilyDayBriefAnniversary {
  memberId: string;
  memberName: string;
  colour: string;
  kind: AnniversaryKind;
  title: string;
  years: number | null;
}

export type FamilyDayBriefMealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface FamilyDayBriefMeal {
  id: string;
  date: Date;
  slot: FamilyDayBriefMealSlot;
  /** Rezepttitel, sonst die freie Notiz („Reste") — was auf dem Tisch steht. */
  title: string;
  recipeId: string | null;
  servings: number | null;
  cooked: boolean;
}

export interface FamilyDayBriefTask {
  id: string;
  title: string;
  category: string;
  nextDueAt: Date;
  /** Fällig, bevor der Zeitraum überhaupt beginnt. */
  overdue: boolean;
}

export interface FamilyDayBriefHealthItem {
  id: string;
  memberId: string;
  memberName: string;
  kind: FamilyHealthRecordKind;
  title: string;
  nextDueOn: Date;
}

export interface FamilyDayBriefShoppingItem {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  unitLabel: string | null;
  category: string;
}

export interface FamilyDayBriefShopping {
  listId: string;
  title: string;
  openCount: number;
  /** Gekürzt auf `shoppingItemLimit`; `openCount` bleibt die volle Zahl. */
  openItems: readonly FamilyDayBriefShoppingItem[];
}

export interface FamilyDayBriefDay {
  /** Lokales Datum als `YYYY-MM-DD` — der Schlüssel, nach dem gruppiert wird. */
  date: string;
  label: string;
  isToday: boolean;
  events: FamilyDayBriefEvent[];
  anniversaries: FamilyDayBriefAnniversary[];
  meals: FamilyDayBriefMeal[];
  tasksDue: FamilyDayBriefTask[];
  healthDue: FamilyDayBriefHealthItem[];
}

export interface FamilyDayBriefInput {
  /** Bezugszeitpunkt — bestimmt, welcher Tag „heute" ist. */
  at: Date;
  from: Date;
  to: Date;
  members: readonly FamilyDayBriefMember[];
  events: readonly FamilyDayBriefEvent[];
  anniversaries: readonly FamilyDayBriefAnniversary[];
  anniversaryDates: readonly Date[];
  meals: readonly FamilyDayBriefMeal[];
  tasks: readonly FamilyDayBriefTask[];
  healthDue: readonly FamilyDayBriefHealthItem[];
  shopping: FamilyDayBriefShopping | null;
}

export interface FamilyDayBrief {
  generatedAt: Date;
  range: { from: Date; to: Date };
  members: readonly FamilyDayBriefMember[];
  days: FamilyDayBriefDay[];
  shopping: FamilyDayBriefShopping | null;
  counts: {
    events: number;
    meals: number;
    tasksDue: number;
    healthDue: number;
    shoppingOpen: number;
  };
}

const DAY_LABEL = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Lokaler Tagesschlüssel. Termine und Aufgaben liegen in Ortszeit. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Geburtstage kommen als UTC-Mitternacht herein (siehe `anniversaries.ts`) —
 * für die hätte die Ortszeit-Umrechnung den Tag verschoben.
 */
export function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Zeitraum ab dem Beginn des Bezugstages. `days = 1` ist heute, `2` heute und
 * morgen — mehr braucht ein Tablet an der Wand nicht.
 */
export function dayRange(reference: Date, days = FAMILY_DAY_BRIEF_MAX_DAYS): { from: Date; to: Date } {
  const span = Math.min(Math.max(Math.trunc(days) || 1, 1), FAMILY_DAY_BRIEF_MAX_DAYS);

  const from = new Date(reference);
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(to.getDate() + span - 1);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

function dayKeysInRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0); // Mittags zählen — so überspringt die Zeitumstellung keinen Tag.
  const end = to.getTime();

  while (cursor.getTime() <= end) {
    keys.push(localDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

/**
 * Baut den Tagesstand aus den eingesammelten Rohdaten. Rein: kein `new Date()`
 * ohne Bezug, keine Datenbank — der Bezugszeitpunkt kommt als `at` herein.
 */
export function buildFamilyDayBrief(input: FamilyDayBriefInput): FamilyDayBrief {
  const todayKey = localDayKey(input.at);
  const keys = dayKeysInRange(input.from, input.to);

  const days: FamilyDayBriefDay[] = keys.map((key) => {
    const [year, month, day] = key.split("-").map(Number);
    return {
      date: key,
      label: DAY_LABEL.format(new Date(year, month - 1, day)),
      isToday: key === todayKey,
      events: [],
      anniversaries: [],
      meals: [],
      tasksDue: [],
      healthDue: [],
    };
  });

  const byKey = new Map(days.map((day) => [day.date, day]));
  const firstDay = days[0];

  for (const event of input.events) {
    byKey.get(localDayKey(event.startAt))?.events.push(event);
  }

  input.anniversaries.forEach((anniversary, index) => {
    const date = input.anniversaryDates[index];
    if (date) byKey.get(utcDayKey(date))?.anniversaries.push(anniversary);
  });

  for (const meal of input.meals) {
    byKey.get(localDayKey(meal.date))?.meals.push(meal);
  }

  for (const item of input.healthDue) {
    byKey.get(utcDayKey(item.nextDueOn))?.healthDue.push(item);
  }

  // Überfälliges gehört auf den ersten Tag, sonst fällt es aus dem Blick —
  // eine Aufgabe von letzter Woche ist heute noch offen.
  for (const task of input.tasks) {
    const target = task.overdue ? firstDay : byKey.get(localDayKey(task.nextDueAt));
    target?.tasksDue.push(task);
  }

  return {
    generatedAt: input.at,
    range: { from: input.from, to: input.to },
    members: input.members,
    days,
    shopping: input.shopping,
    counts: {
      events: days.reduce((sum, day) => sum + day.events.length, 0),
      meals: days.reduce((sum, day) => sum + day.meals.length, 0),
      tasksDue: days.reduce((sum, day) => sum + day.tasksDue.length, 0),
      healthDue: days.reduce((sum, day) => sum + day.healthDue.length, 0),
      shoppingOpen: input.shopping?.openCount ?? 0,
    },
  };
}

/** Der Ausschnitt des Kalender-Dienstes, den der Tagesstand braucht. */
export interface DayBriefCalendarSource {
  listEvents(options: {
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<
    readonly {
      id: string;
      title: string;
      startAt: Date;
      endAt: Date | null;
      allDay: boolean;
      location: string | null;
    }[]
  >;
}

export interface LoadFamilyDayBriefOptions {
  familyDb: FamilyPrismaClient;
  calendar: DayBriefCalendarSource;
  /** Bezugszeitpunkt; Default „jetzt". Testbar, ohne die Uhr zu stellen. */
  at?: Date;
  days?: number;
  shoppingItemLimit?: number;
}

async function loadMeals(
  db: FamilyPrismaClient,
  from: Date,
  to: Date,
): Promise<FamilyDayBriefMeal[]> {
  const plans = createMealPlanService(db);

  // Heute und morgen können in zwei ISO-Wochen liegen (Sonntag → Montag).
  const weeks = new Map<string, { isoYear: number; isoWeek: number }>();
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);
  while (cursor.getTime() <= to.getTime()) {
    const iso = isoWeekOf(cursor);
    weeks.set(`${iso.isoYear}-${iso.isoWeek}`, iso);
    cursor.setDate(cursor.getDate() + 1);
  }

  const loaded = await Promise.all(
    [...weeks.values()].map((iso) => plans.getWeek(iso.isoYear, iso.isoWeek)),
  );

  return loaded
    .flatMap((week) => week?.entries ?? [])
    .filter((entry) => entry.date.getTime() >= from.getTime() && entry.date.getTime() <= to.getTime())
    .map((entry) => ({
      id: entry.id,
      date: entry.date,
      slot: entry.slot as FamilyDayBriefMealSlot,
      title: entry.recipe?.title ?? entry.note.trim(),
      recipeId: entry.recipeId,
      servings: entry.servings,
      cooked: entry.cooked,
    }))
    .filter((meal) => meal.title !== "");
}

async function loadShopping(
  db: FamilyPrismaClient,
  limit: number,
): Promise<FamilyDayBriefShopping | null> {
  const shopping = createShoppingService(db);
  const lists = await shopping.listLists();
  const open = lists.find((list) => !list.done);
  if (!open) return null;

  const list = await shopping.getList(open.id);
  if (!list) return null;

  const openItems = list.items.filter((item) => !item.checked);

  return {
    listId: list.id,
    title: list.title,
    openCount: openItems.length,
    openItems: openItems.slice(0, limit).map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      unitLabel: item.unitLabel,
      category: item.category,
    })),
  };
}

/**
 * Sammelt den Tagesstand aus dem Haushalts-Bestand ein.
 *
 * Jede Quelle bleibt bei ihrem eigenen Service — hier wird nur zusammengeführt,
 * nicht neu interpretiert.
 */
export async function loadFamilyDayBrief(
  options: LoadFamilyDayBriefOptions,
): Promise<FamilyDayBrief> {
  const at = options.at ?? new Date();
  const { from, to } = dayRange(at, options.days);
  const limit = options.shoppingItemLimit ?? DEFAULT_SHOPPING_ITEM_LIMIT;

  const [rawEvents, members, healthRecords, maintenance, meals, shopping] = await Promise.all([
    options.calendar.listEvents({ from, to, limit: 200 }),
    createFamilyMemberService(options.familyDb).listMembers(),
    options.familyDb.familyHealthRecord.findMany({
      where: { nextDueOn: { not: null, gte: from, lte: to } },
      orderBy: { nextDueOn: "asc" },
      include: { member: { select: { id: true, displayName: true } } },
    }),
    options.familyDb.maintenanceTask.findMany({
      where: { nextDueAt: { not: null, lte: to } },
      orderBy: { nextDueAt: "asc" },
    }),
    loadMeals(options.familyDb, from, to),
    loadShopping(options.familyDb, limit),
  ]);

  const enriched = await attachMembersToEvents(options.familyDb, rawEvents);
  const anniversaries = expandAnniversaries(members, {
    from,
    to,
    colourOf: resolveMemberColour,
  });

  return buildFamilyDayBrief({
    at,
    from,
    to,
    members: members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      colour: resolveMemberColour(member),
    })),
    events: enriched.map((event) => ({
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      location: event.location,
      memberIds: event.members.map((member) => member.id),
      memberNames: event.members.map((member) => member.displayName),
    })),
    anniversaries: anniversaries.map((occurrence) => ({
      memberId: occurrence.memberId,
      memberName: occurrence.memberName,
      colour: occurrence.colour,
      kind: occurrence.kind,
      title: occurrence.title,
      years: occurrence.years,
    })),
    anniversaryDates: anniversaries.map((occurrence) => occurrence.date),
    meals,
    tasks: maintenance.flatMap((task) =>
      task.nextDueAt
        ? [
            {
              id: task.id,
              title: task.title,
              category: task.category,
              nextDueAt: task.nextDueAt,
              overdue: task.nextDueAt.getTime() < from.getTime(),
            },
          ]
        : [],
    ),
    healthDue: healthRecords.flatMap((record) =>
      record.nextDueOn
        ? [
            {
              id: record.id,
              memberId: record.member.id,
              memberName: record.member.displayName,
              kind: record.kind as FamilyHealthRecordKind,
              title: record.title,
              nextDueOn: record.nextDueOn,
            },
          ]
        : [],
    ),
    shopping,
  });
}
