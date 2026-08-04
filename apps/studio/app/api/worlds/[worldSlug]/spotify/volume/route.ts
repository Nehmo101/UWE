import { z } from "zod";
import { withWorldBodyRoute } from "@/src/lib/world-route";
import { setSpotifyVolumeForWorld } from "@/src/lib/spotify-handlers";

const spotifyVolumeBodySchema = z.object({
  volume: z.number().min(0).max(100).optional(),
});

export const POST = withWorldBodyRoute(spotifyVolumeBodySchema, (worldSlug, body) =>
  setSpotifyVolumeForWorld(worldSlug, body),
);
