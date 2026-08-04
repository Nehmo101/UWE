import { withWorldRoute } from "@/src/lib/world-route";
import { resumeSpotifyForWorld } from "@/src/lib/spotify-handlers";

export const POST = withWorldRoute(resumeSpotifyForWorld);
