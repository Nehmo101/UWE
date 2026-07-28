"use server";

import { resolveUweAppUrls } from "@uwe/auth";
import { requireBrainActionAuth } from "@/src/lib/brain-action-auth";
import { revalidateBrainPaths } from "@/src/lib/brain-action-shared";

/**
 * Morning Briefing von Brain aus anstoßen.
 *
 * Die Job-Queue läuft im Studio-Prozess — Brain hat keine eigene. Der Trigger
 * geht deshalb über dieselbe interne Route, die auch der systemd-Timer
 * (`uwe-briefing.timer`) benutzt: gleiche Guard, gleicher Job, ein Weg statt
 * zwei. Ohne `STUDIO_API_TOKEN` gibt es keinen manuellen Trigger; das Briefing
 * läuft dann nur nach Zeitplan, und die Seite sagt das auch.
 */

export async function generateMorningBriefingAction(): Promise<void> {
  await requireBrainActionAuth();

  const token = process.env.STUDIO_API_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "STUDIO_API_TOKEN ist nicht gesetzt — das Briefing lässt sich von hier aus nicht starten.",
    );
  }

  const base = resolveUweAppUrls().studioUrl?.replace(/\/$/, "") || "http://127.0.0.1:3000";
  const response = await fetch(`${base}/api/internal/briefing`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Briefing konnte nicht gestartet werden (HTTP ${response.status}).`);
  }

  revalidateBrainPaths();
}
