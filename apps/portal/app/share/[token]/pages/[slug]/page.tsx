import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  AppShell,
  PageHeader,
  TopBarBrand,
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
    return (
      <main className="share-gate">
        <SharePasswordForm token={token} />
      </main>
    );
  }

  if (result.kind === "password_required") {
    return (
      <main className="share-gate">
        <div className="share-password-form">
          <h1>Passwort erforderlich</h1>
          <p>
            Dieser Freigabe-Link ist nicht passwortgeschützt. In Production müssen
            Share-Links ein Passwort haben (PLAYER_PREVIEW_REQUIRE_TOKEN).
          </p>
        </div>
      </main>
    );
  }

  if (result.kind === "disabled") {
    return (
      <main className="share-gate">
        <div className="share-password-form">
          <h1>Freigabe deaktiviert</h1>
          <p>Öffentliche Freigaben sind derzeit systemweit deaktiviert.</p>
        </div>
      </main>
    );
  }

  if (result.kind === "not_found") {
    notFound();
  }

  const { view, readOnly } = result;

  return (
    <AppShell
      topBar={
        <TopBarBrand
          appName="UWE Freigabe"
          subtitle={readOnly ? "Nur-Lesen" : "Freigegebener Inhalt"}
          href={`/share/${token}`}
        />
      }
      main={
        <>
          <PageHeader
            title={view.page.title}
            meta={view.page.tags.map((tag) => (
              <span key={tag} className="uwe-tag">
                {tag}
              </span>
            ))}
          />
          <WikiContent html={view.html} />
        </>
      }
      context={
        <WikiSidebar backlinks={view.backlinks} relatedPages={view.relatedPages} />
      }
    />
  );
}
