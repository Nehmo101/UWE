import { z } from "zod";
import { withWorldBodyRoute } from "@/src/lib/world-route";
import { playSpotifyForWorld } from "@/src/lib/spotify-handlers";

const spotifyPlayBodySchema = z.object({
  uri: z.string().max(500).optional(),
  volume: z.number().min(0).max(100).optional(),
});

export const POST = withWorldBodyRoute(spotifyPlayBodySchema, (worldSlug, body) =>
  playSpotifyForWorld(worldSlug, body),
);
