import { withWorldRoute } from "@/src/lib/world-route";
import { startSpotifyConnect } from "@/src/lib/spotify-handlers";

export const GET = withWorldRoute(startSpotifyConnect);
