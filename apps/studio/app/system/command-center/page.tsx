import { requireOwner } from "@/src/lib/auth";
import { prisma } from "@uwe/database/server";
import { BreadcrumbTrail } from "@/src/components/shell";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { getCommandCenterData } from "@/src/lib/command-center-data";
import { CommandCenterClient } from "./CommandCenterClient";

export const dynamic = "force-dynamic";

export default async function SystemCommandCenterPage() {
  await requireOwner();
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const initial = await getCommandCenterData(prisma, { useMockInference });

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Heute", href: "/today" },
            { label: "System", href: "/system" },
            { label: "Kommandozentrale" },
          ]}
        />
      }
    >
      <CommandCenterClient initial={initial} />
    </SystemShell>
  );
}
