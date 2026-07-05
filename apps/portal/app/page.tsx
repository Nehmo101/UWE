import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";

export default async function LandingPage() {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/login?redirect=/auth/worlds");
  }

  if (user) {
    redirect("/auth/worlds");
  }

  redirect("/login?redirect=/auth/worlds");
}
