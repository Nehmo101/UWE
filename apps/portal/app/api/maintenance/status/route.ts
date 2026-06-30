import { getSystemSettingsSnapshot } from "@uwe/database/server";

export async function GET() {
  const { settings } = await getSystemSettingsSnapshot();
  return Response.json({
    maintenance: settings.maintenance,
  });
}
