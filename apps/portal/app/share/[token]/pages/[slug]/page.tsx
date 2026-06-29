import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  WikiContent,
  WikiSidebar,
} from "@uwe/shared-ui";
import {
  buildPageView,
  createPrismaClient,
  createShareLinkService,
  getAppRepository,
} from "@uwe/database/server";
import { SharePasswordForm } from "@/src/components/SharePasswordForm";
import { ShareGateMessage } from "@/src/components/ShareGateMessage";
import { PageHeader, PortalShell } from "@/src/components/shell";
import { shareNavGroups } from "@/src/navigation/portal-nav";
import { isShareFeatureEnabled, isShareLinkPasswordRequired } from "@/src/lib/share-access";
import { isSharePasswordVerified } from "@/src/lib/share-auth";
import { resolveClientIp } from "@uwe/auth";

interface Props {
  params: Promise<{ token: string; slug: string }>;
}

async function resolveSharePageView(token: string, pageSlug: string) {
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

    if (!access || access.target.kind !== "page") {
      return { kind: "not_found" as const };
    }

    const view = await buildPageView(repo, access.target.worldSlug, pageSlug, "share", {
      shareGrant: access.grant,
      shareToken: token,
    });

    if (!view) {
      return { kind: "not_found" as const };
    }

    return {
      kind: "page" as const,
      view,
      readOnly: access.link.readOnly,
      worldSlug: access.target.worldSlug,
      pageType: access.target.page.type,
    };
  } finally {
    await db.$disconnect();
  }
}

export default async function ShareLinkedPageView({ params }: Props) {
  const { token, slug } = await params;
  const result = await resolveSharePageView(token, slug);

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

  if (result.kind === "not_found") {
    notFound();
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
