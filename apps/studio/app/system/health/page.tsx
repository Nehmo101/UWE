import { prisma } from "@uwe/database/server";
import { createHealthMetricsService } from "@uwe/database/health-metrics";
import { requireStudioAccess } from "@/src/lib/auth";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { BuildVersionFooter } from "@/src/components/system/BuildVersion";
import { SystemHealthClient } from "@/src/components/system/SystemHealthClient";
import { getBuildInfo } from "@/src/lib/build-info";
import { loadStudioRtxDisplayState } from "@/src/lib/rtx-display-state";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  await requireStudioAccess();
  const info = getBuildInfo();
  const [metrics, rtxDisplay] = await Promise.all([
    createHealthMetricsService(prisma).getMetrics(),
    loadStudioRtxDisplayState(prisma).catch(() => null),
  ]);

  return (
    <SystemShell
      breadcrumb={<span>System / Health</span>}
      footer={<BuildVersionFooter info={info} />}
    >
      <SystemHealthClient initialMetrics={metrics} initialRtxDisplay={rtxDisplay} />
    </SystemShell>
  );
}
