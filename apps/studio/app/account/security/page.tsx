import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, AuthPageLayout, TwoFactorSetupForm } from "@uwe/shared-ui";
import { BreadcrumbTrail, SystemShell } from "@/src/components/shell";
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
      <AuthPageLayout variant="studio" compact>
        <AuthCard
          variant="studio"
          title="Sicherheit"
          lead={`Angemeldet als ${user.displayName}${user.email ? ` (${user.email})` : ""}.`}
          footer={<Link href="/account/password">Passwort ändern</Link>}
        >
          <TwoFactorSetupForm variant="studio" backHref="/account/password" />
        </AuthCard>
      </AuthPageLayout>
    </SystemShell>
  );
}
