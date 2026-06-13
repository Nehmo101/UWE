import { headers } from "next/headers";
import Link from "next/link";
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
  getAppRepository,
  createPrismaClient,
  createShareLinkService,
} from "@uwe/database/server";
import { SharePasswordForm } from "@/src/components/SharePasswordForm";
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

  if (result.kind === "asset") {
    const { asset, fileUrl, readOnly } = result;
    const previewable = isPreviewable(asset.mimeType);

    return (
      <AppShell
        topBar={
          <TopBarBrand
            appName="UWE Freigabe"
            subtitle={readOnly ? "Nur-Lesen" : "Freigegebenes Asset"}
            href={`/share/${token}`}
          />
        }
        main={
          <>
            <PageHeader title={asset.title} summary={asset.description} />
            {previewable ? (
              asset.mimeType?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl} alt={asset.title} className="share-asset-preview" />
              ) : (
                <iframe src={fileUrl} title={asset.title} className="share-asset-preview" />
              )
            ) : (
              <p>
                <Link href={fileUrl} className="uwe-btn uwe-btn-primary">
                  Datei herunterladen
                </Link>
              </p>
            )}
          </>
        }
      />
    );
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
