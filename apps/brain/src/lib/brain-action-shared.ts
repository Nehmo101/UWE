import { brainPrisma } from "@uwe/database/brain-client";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";

/**
 * Geteilte Helfer der Brain-Server-Actions.
 *
 * Eigene Datei, weil ein `"use server"`-Modul ausschließlich async Funktionen
 * exportieren darf — synchrone Helfer müssen daher außerhalb liegen, sobald
 * mehr als eine Action-Datei sie braucht.
 */

export function lifeAdmin() {
  return createLifeAdminService(brainPrisma, prisma);
}

export function str(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

/** Mehrzeiliges Textarea-Feld → getrimmte, leere Zeilen verworfen. */
export function lines(value: FormDataEntryValue | null): string[] {
  return str(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Kommagetrenntes Feld → getrimmte Einträge. */
export function commaList(value: FormDataEntryValue | null): string[] {
  return str(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const BRAIN_PATHS = [
  "/",
  "/today",
  "/life-brain",
  "/capture",
  "/projects",
  "/workshop",
  "/contracts",
  "/hardware",
  "/documents",
  "/system",
];

export function revalidateBrainPaths(): void {
  for (const path of BRAIN_PATHS) {
    revalidatePath(path);
  }
}
