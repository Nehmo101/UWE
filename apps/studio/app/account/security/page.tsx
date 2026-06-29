import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorSetupForm } from "@/src/components/TwoFactorSetupForm";
import { BreadcrumbTrail, SystemShell } from "@/src/components/shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { getCurrentAuthUser } from "@/src/lib/auth";

export default async function AccountSecurityPage() {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect("/login?redirect=/account/security");
  }

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Einstellungen", href: "/settings" },
            { label: "Sicherheit (2FA)" },
          ]}
        />
      }
    >
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Sicherheit</CardTitle>
          <CardDescription>
            Angemeldet als {user.displayName}
            {user.email ? ` (${user.email})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetupForm backHref="/account/password" />
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/account/password" className="text-primary hover:underline">
              Passwort ändern
            </Link>
          </p>
        </CardContent>
      </Card>
    </SystemShell>
  );
}
