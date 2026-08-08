import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";

/** Auth route group — shells are provided by nested layouts. */
export default async function AuthGroupLayout({ children }: { children: ReactNode }) {
  if (!(await getCurrentUser())) {
    redirect("/login?reason=portal-access");
  }

  return children;
}
