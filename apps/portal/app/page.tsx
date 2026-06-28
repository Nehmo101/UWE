import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/auth/worlds");
  }

  redirect("/login?redirect=/auth/worlds");
}
