import { requireAdminAccess } from "@/src/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminAccess();
  return children;
}
