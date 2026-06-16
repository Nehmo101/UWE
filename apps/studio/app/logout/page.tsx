import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { SESSION_COOKIE_NAME } from "@uwe/auth";

export default async function LogoutPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const db = createPrismaClient();
    const auth = createAuthService(db);
    try {
      await auth.deleteSession(token);
    } finally {
      await db.$disconnect();
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
