import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorSetupForm } from "@uwe/shared-ui";
import { PageHeader } from "@/src/components/shell";
import { Card, CardContent } from "@/src/components/ui/card";
import { getCurrentUser } from "@/src/lib/auth";

export default async function PortalAccountSecurityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?redirect=/auth/account/security");
  }

  return (
    <>
      <PageHeader
        title="Sicherheit"
        summary={`Angemeldet als ${user.displayName}${user.email ? ` (${user.email})` : ""}.`}
      />
      <Card className="max-w-md">
        <CardContent className="pt-6">
          <TwoFactorSetupForm variant="portal" backHref="/auth/account/password" />
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/auth/account/password" className="text-primary hover:underline">
              Passwort ändern
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
