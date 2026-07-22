import { generateIcalCalendar } from "@uwe/calendar";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { parseRentalReturnDue } from "@/src/lib/workshop-rental-due";
import { brainPrisma } from "@uwe/database/brain-client";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
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
