import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  WikiContent,
  WikiSidebar,
} from "@uwe/shared-ui";
import {
  buildPageView,
  getAppRepository,
  createPrismaClient,
  createShareLinkService,
  isShareLinkActive,
} from "@uwe/database/server";
import { SharePasswordForm } from "@/src/components/SharePasswordForm";
import { ShareGateMessage } from "@/src/components/ShareGateMessage";
import { PageHeader, PortalShell } from "@/src/components/shell";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { shareNavGroups } from "@/src/navigation/portal-nav";
import { isShareFeatureEnabled, isShareLinkPasswordRequired } from "@/src/lib/share-access";
import { isSharePasswordVerified } from "@/src/lib/share-auth";
import { resolveClientIp } from "@uwe/auth";

interface Props {
  params: Promise<{ token: string }>;
}

function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

async function resolveShareView(token: string) {
  if (!(await isShareFeatureEnabled())) {
    return { kind: "disabled" as const };
  }

  const db = createPrismaClient();
  const shareService = createShareLinkService(db);
  const repo = getAppRepository();

  try {
    const passwordVerified = await isSharePasswordVerified(token);
    const link = await shareService.getShareLinkByToken(token);

    if (!link) {
      return { kind: "not_found" as const };
    }

    if (!isShareLinkActive(link)) {
      return link.enabled
        ? { kind: "expired" as const, expiresAt: link.expiresAt }
        : { kind: "disabled_link" as const };
    }

    if (isShareLinkPasswordRequired(link)) {
      return { kind: "password_required" as const };
    }

    if (link.passwordHash && !passwordVerified) {
      return { kind: "password" as const };
    }

    const headersList = await headers();
    const access = await shareService.validateShareAccess(token, {
      passwordVerified,
      meta: {
        ipAddress: resolveClientIp(headersList),
        userAgent: headersList.get("user-agent"),
      },
    });

    if (!access) {
      return { kind: "not_found" as const };
    }

    if (access.target.kind === "asset") {
      const { asset, worldSlug } = access.target;
      const fileUrl = `/api/share/${token}/assets/${asset.id}/file`;
      return {
        kind: "asset" as const,
        asset,
        worldSlug,
        fileUrl,
        readOnly: access.link.readOnly,
      };
    }

    const { page, worldSlug } = access.target;
    const view = await buildPageView(repo, worldSlug, page.slug, "share", {
      shareGrant: access.grant,
      shareToken: token,
    });

    if (!view) {
      return { kind: "not_found" as const };
    }

    return {
      kind: "page" as const,
      view,
      worldSlug,
      pageType: page.type,
      readOnly: access.link.readOnly,
    };
  } finally {
    await db.$disconnect();
  }
}

export default async function ShareLinkView({ params }: Props) {
  const { token } = await params;
  const result = await resolveShareView(token);

  if (result.kind === "password") {
    return <SharePasswordForm token={token} />;
  }

  if (result.kind === "password_required") {
    return (
      <ShareGateMessage
        title="Passwort erforderlich"
        description="Dieser Freigabe-Link ist nicht passwortgeschützt. In Production müssen Share-Links ein Passwort haben (PLAYER_PREVIEW_REQUIRE_TOKEN)."
      />
    );
  }

  if (result.kind === "disabled") {
    return (
      <ShareGateMessage
        title="Freigabe deaktiviert"
        description="Öffentliche Freigaben sind derzeit systemweit deaktiviert."
      />
    );
  }

  if (result.kind === "expired") {
    const expiryHint = result.expiresAt
      ? ` Der Link war bis ${result.expiresAt.toLocaleDateString("de-DE")} gültig.`
      : "";
    return (
      <ShareGateMessage
        title="Link abgelaufen"
        description={`Dieser Freigabe-Link ist nicht mehr gültig.${expiryHint} Bitte den Spielleiter um einen neuen Link.`}
      />
    );
  }

  if (result.kind === "disabled_link") {
    return (
      <ShareGateMessage
        title="Link deaktiviert"
        description="Der Spielleiter hat diesen Freigabe-Link deaktiviert. Bitte um einen neuen Link."
      />
    );
  }

  if (result.kind === "not_found") {
    notFound();
  }

  if (result.kind === "asset") {
    const { asset, fileUrl, readOnly: _readOnly } = result;
    const previewable = isPreviewable(asset.mimeType);

    return (
      <PortalShell
        brandLabel="UWE Freigabe"
        brandHref={`/share/${token}`}
        navGroups={shareNavGroups(token)}
      >
        <PageHeader title={asset.title} summary={asset.description} />
        {previewable ? (
          asset.mimeType?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={asset.title}
              className="max-h-[70vh] w-full rounded-[var(--radius)] border border-border object-contain"
            />
          ) : (
            <iframe
              src={fileUrl}
              title={asset.title}
              className="h-[70vh] w-full rounded-[var(--radius)] border border-border"
            />
          )
        ) : (
          <Link href={fileUrl} className={cn(buttonVariants())}>
            Datei herunterladen
          </Link>
        )}
      </PortalShell>
    );
  }

  const { view } = result;

  return (
    <PortalShell
      brandLabel="UWE Freigabe"
      brandHref={`/share/${token}`}
      navGroups={shareNavGroups(token)}
      contextPanel={
        <WikiSidebar backlinks={view.backlinks} relatedPages={view.relatedPages} />
      }
    >
      <PageHeader
        title={view.page.title}
        meta={view.page.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      />
      <WikiContent html={view.html} />
    </PortalShell>
  );
}
