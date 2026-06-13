import {
  composeHandoutMail,
  composeSessionRecapMail,
  composeShareLinkMail,
  type HandoutSource,
  type MailComposeKind,
  type MailDraft,
  type SessionRecapSource,
  type ShareLinkSource,
} from "@uwe/mail";
import type { PrismaClient } from "./client";
import { buildShareUrl } from "./share-link-service";

export class MailComposeService {
  constructor(private readonly db: PrismaClient) {}

  async composeSessionRecap(worldSlug: string, sessionId: string): Promise<MailDraft | null> {
    const session = await this.db.gameSession.findFirst({
      where: {
        id: sessionId,
        world: { slug: worldSlug },
      },
      select: {
        id: true,
        worldId: true,
        title: true,
        sessionNumber: true,
        summaryPlayer: true,
        summaryDm: true,
      },
    });

    if (!session) {
      return null;
    }

    const source: SessionRecapSource = {
      worldId: session.worldId,
      sessionId: session.id,
      sessionTitle: session.title,
      sessionNumber: session.sessionNumber,
      summaryPlayer: session.summaryPlayer,
      summaryDm: session.summaryDm,
    };

    return composeSessionRecapMail(source);
  }

  async composeHandout(worldSlug: string, assetId: string, portalBaseUrl?: string): Promise<MailDraft | null> {
    const asset = await this.db.asset.findFirst({
      where: {
        id: assetId,
        world: { slug: worldSlug },
      },
      select: {
        id: true,
        worldId: true,
        title: true,
        description: true,
        visibility: true,
      },
    });

    if (!asset) {
      return null;
    }

    const source: HandoutSource = {
      worldId: asset.worldId,
      assetId: asset.id,
      title: asset.title,
      description: asset.description,
      visibility: asset.visibility,
      publicUrl:
        portalBaseUrl && asset.visibility !== "dm_only"
          ? `${portalBaseUrl.replace(/\/$/, "")}/worlds/${worldSlug}/assets/${asset.id}`
          : undefined,
    };

    return composeHandoutMail(source);
  }

  async composeShareLink(
    worldSlug: string,
    shareLinkId: string,
    portalBaseUrl?: string,
  ): Promise<MailDraft | null> {
    const link = await this.db.shareLink.findFirst({
      where: {
        id: shareLinkId,
        world: { slug: worldSlug },
      },
      select: {
        id: true,
        worldId: true,
        token: true,
        targetType: true,
        targetId: true,
      },
    });

    if (!link) {
      return null;
    }

    const targetLabel = await this.resolveShareTargetLabel(link.targetType, link.targetId);
    const publicUrl = buildShareUrl(link.token, portalBaseUrl);

    const source: ShareLinkSource = {
      worldId: link.worldId,
      shareLinkId: link.id,
      targetLabel,
      publicUrl,
    };

    return composeShareLinkMail(source);
  }

  async compose(
    kind: MailComposeKind,
    worldSlug: string,
    sourceId: string,
    portalBaseUrl?: string,
  ): Promise<MailDraft | null> {
    switch (kind) {
      case "session_recap":
        return this.composeSessionRecap(worldSlug, sourceId);
      case "handout":
        return this.composeHandout(worldSlug, sourceId, portalBaseUrl);
      case "share_link":
        return this.composeShareLink(worldSlug, sourceId, portalBaseUrl);
      default: {
        const _exhaustive: never = kind;
        throw new Error(`Unbekannter Compose-Typ: ${String(_exhaustive)}`);
      }
    }
  }

  private async resolveShareTargetLabel(targetType: string, targetId: string): Promise<string> {
    if (targetType === "page") {
      const page = await this.db.page.findUnique({
        where: { id: targetId },
        select: { title: true },
      });
      return page?.title ?? "Seite";
    }

    if (targetType === "asset") {
      const asset = await this.db.asset.findUnique({
        where: { id: targetId },
        select: { title: true },
      });
      return asset?.title ?? "Handout";
    }

    return "Freigabe";
  }
}

export function createMailComposeService(db: PrismaClient): MailComposeService {
  return new MailComposeService(db);
}
