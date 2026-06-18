import { UweLandingPage } from "@uwe/shared-ui";
import { getCurrentUser } from "@/src/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <UweLandingPage
      currentApp="portal"
      isLoggedIn={Boolean(user)}
      userDisplayName={user?.displayName}
    />
  );
}
