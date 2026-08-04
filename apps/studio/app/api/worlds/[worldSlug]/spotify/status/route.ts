import { withWorldRoute } from "@/src/lib/world-route";
import { getSpotifyStatus } from "@/src/lib/spotify-handlers";

export const GET = withWorldRoute(getSpotifyStatus);
