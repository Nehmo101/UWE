import { z } from "zod";
import { withWorldBodyRoute } from "@/src/lib/world-route";
import { setPreferredSpotifyDevice } from "@/src/lib/spotify-handlers";

const setDeviceSchema = z.object({
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
});

export const POST = withWorldBodyRoute(setDeviceSchema, (worldSlug, body) =>
  setPreferredSpotifyDevice(worldSlug, body),
);
