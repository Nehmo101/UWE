import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { UweLandingPage } from "@uwe/shared-ui";
import { getCurrentUser } from "@/src/lib/auth";

async function isSetupAvailable() {
  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    return await auth.isSetupAvailable();
  } catch {
    return false;
  } finally {
    await db.$disconnect();
  }
}

export default async function LandingPage() {
  const user = await getCurrentUser();
  const showSystemStatusLink = user?.role === "owner" || user?.role === "admin";

  return (
    <UweLandingPage
      currentApp="studio"
      isLoggedIn={Boolean(user)}
      userDisplayName={user?.displayName}
      showSetupLink={await isSetupAvailable()}
      showSystemStatusLink={showSystemStatusLink}
    />
  );
}
