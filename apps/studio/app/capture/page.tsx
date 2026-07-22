import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createLifeAdminService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { CaptureImageUpload } from "@/components/CaptureImageUpload";
import { QuickCaptureForm } from "@/components/capture/QuickCaptureForm";
import { CaptureInboxList } from "@/components/capture/CaptureInboxList";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  buttonVariants,
  cn,
} from "@/src/components/ui";

interface Props {
  searchParams: Promise<{ quick?: string; status?: string; source?: string }>;
}

function parseSourceFilter(value: string | undefined): "manual" | "mail" | "scan" | undefined {
  if (value === "manual" || value === "mail" || value === "scan") return value;
  return undefined;
}

const FILTER_TABS = [
  { key: "inbox", label: "Inbox", href: "/capture" },
  { key: "archived", label: "Archiv", href: "/capture?status=archived" },
  { key: "all", label: "Alle", href: "/capture?status=all" },
] as const;

export default async function CapturePage({ searchParams }: Props) {
  const { quick, status, source } = await searchParams;
  const service = createLifeAdminService(brainPrisma, prisma);
  const worlds = await getAppRepository().listWorldsWithGuestMode();
  const statusFilter =
    status === "archived" ? "archived" : status === "all" ? undefined : ("inbox" as const);
  const sourceFilter = parseSourceFilter(source);
  const captures = await service.listCaptures({
    status: statusFilter,
    sourceGroup: sourceFilter,
    limit: 100,
  });
  const showQuickForm = quick === "1" || quick === "true";
  const activeTab = status === "archived" ? "archived" : status === "all" ? "all" : "inbox";

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Capture Inbox" }]} />}>
      <PageHeader
        title="Capture Inbox"
        summary="Universeller mobiler Eingang — Notizen, Ideen, Links, Sprachmemos, Dateien und To-dos ohne RTX."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bild erfassen (Mobile)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Fotos von Miniaturen, Terrain oder Handouts — optional direkt als Asset in einer Welt.
            </p>
            <CaptureImageUpload worlds={worlds.map((world) => ({ slug: world.slug, name: world.name }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{showQuickForm ? "Schnell erfassen" : "Neuer Capture"}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickCaptureForm returnTo="/capture" autoFocus={showQuickForm} compact={showQuickForm} />
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Inbox ({captures.length})</h2>
            <nav className="flex gap-1.5" aria-label="Inbox-Filter">
              {FILTER_TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={activeTab === tab.key ? "page" : undefined}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === tab.key && "border-primary text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>

          {captures.length === 0 ? (
            <EmptyState
              title="Inbox leer"
              description="Erfasse eine Notiz, Idee oder ein To-do — mit optionalem KI-Vorschlag zur Sortierung."
              action={
                <Link href="/capture?quick=1" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Schnell erfassen
                </Link>
              }
            />
          ) : (
            <CaptureInboxList
              captures={captures.map((capture) => ({
                id: capture.id,
                title: capture.title,
                content: capture.content,
                captureType: capture.captureType,
                status: capture.status,
                capturedAt: capture.capturedAt.toISOString(),
                storageKey: capture.storageKey,
                metadata: capture.metadata,
              }))}
              statusFilter={status}
              sourceFilter={sourceFilter}
            />
          )}
        </section>

        <p className="text-sm text-muted-foreground">
          <Link href="/today">← Heute</Link>
        </p>
      </div>
    </StudioShell>
  );
}
