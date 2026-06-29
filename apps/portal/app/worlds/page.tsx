import { redirectLegacyWorldsHub } from "@/src/lib/legacy-world-redirect";

export default async function LegacyWorldsDiscoverPage() {
  await redirectLegacyWorldsHub();
}
