import { withWorldRoute } from "@/src/lib/world-route";
import { stopSpotifyForWorld } from "@/src/lib/spotify-handlers";

export const POST = withWorldRoute(stopSpotifyForWorld);
