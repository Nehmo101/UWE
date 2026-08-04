import { withWorldRoute } from "@/src/lib/world-route";
import { disconnectSpotify } from "@/src/lib/spotify-handlers";

export const POST = withWorldRoute(disconnectSpotify);
