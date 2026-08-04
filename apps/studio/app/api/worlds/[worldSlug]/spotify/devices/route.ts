import { withWorldRoute } from "@/src/lib/world-route";
import { listSpotifyDevicesForWorld } from "@/src/lib/spotify-handlers";

export const GET = withWorldRoute(listSpotifyDevicesForWorld);
