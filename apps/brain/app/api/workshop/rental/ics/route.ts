import { generateIcalCalendar } from "@uwe/calendar";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { parseRentalReturnDue } from "@/src/lib/workshop-rental-due";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainOwnerAuth } from "@/src/lib/owner-auth";

/**
 * iCal-Feed der Terrain-Rückgaben. Lag in Studio; der Verleih gehört zu Brain
 * (Abschnitt H5), also liegt der Feed hier — hinter dem Brain-Häkchen.
 */

export async function GET() {
  const authError = await requireBrainOwnerAuth();
  if (authError) return authError;

  const rentals = await createLifeAdminService(brainPrisma, prisma).listWorkshopTerrainRentals({ limit: 500 });
  const events = rentals.flatMap((rental) => {
    const due = parseRentalReturnDue(rental.notes);
    if (!due) return [];
    const startAt = new Date(`${due}T09:00:00`);
    return [
      {
        uid: `uwe-rental-${rental.id}@uwe.local`,
        title: `Terrain-Rückgabe: ${rental.terrainSetName}`,
        description: rental.boxLabel ? `Kiste: ${rental.boxLabel}` : undefined,
        startAt,
        allDay: true,
      },
    ];
  });

  const ics = generateIcalCalendar(events);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="uwe-terrain-rentals.ics"',
    },
  });
}
