import { withWorldRoute } from "@/src/lib/world-route";
import { pauseSpotifyForWorld } from "@/src/lib/spotify-handlers";

export const POST = withWorldRoute(pauseSpotifyForWorld);
