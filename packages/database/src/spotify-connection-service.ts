import {
  refreshSpotifyAccessToken,
  shouldRefreshSpotifyToken,
  type SpotifyOAuthConfig,
  type SpotifyTokenSet,
} from "@uwe/soundboard";
import type { PrismaClient } from "./generated/prisma/client";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

export interface SpotifyConnectionStatus {
  connected: boolean;
  spotifyUserId?: string;
  spotifyDisplayName?: string | null;
  expiresAt?: string;
  scopes?: string;
  preferredDeviceId?: string | null;
  preferredDeviceName?: string | null;
}

export interface SaveSpotifyConnectionInput {
  worldId: string;
  spotifyUserId: string;
  spotifyDisplayName?: string | null;
  tokens: SpotifyTokenSet;
}

export class SpotifyConnectionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly oauthConfig: SpotifyOAuthConfig,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  async getStatusByWorldSlug(worldSlug: string): Promise<SpotifyConnectionStatus> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: {
        spotifyConnection: {
          select: {
            spotifyUserId: true,
            spotifyDisplayName: true,
            expiresAt: true,
            scopes: true,
            preferredDeviceId: true,
            preferredDeviceName: true,
          },
        },
      },
    });

    if (!world?.spotifyConnection) {
      return { connected: false };
    }

    return {
      connected: true,
      spotifyUserId: world.spotifyConnection.spotifyUserId,
      spotifyDisplayName: world.spotifyConnection.spotifyDisplayName,
      expiresAt: world.spotifyConnection.expiresAt.toISOString(),
      scopes: world.spotifyConnection.scopes,
      preferredDeviceId: world.spotifyConnection.preferredDeviceId,
      preferredDeviceName: world.spotifyConnection.preferredDeviceName,
    };
  }

  async setPreferredDevice(
    worldSlug: string,
    deviceId: string | null,
    deviceName: string | null,
  ): Promise<boolean> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return false;
    }

    const updated = await this.db.spotifyConnection.updateMany({
      where: { worldId: world.id },
      data: { preferredDeviceId: deviceId, preferredDeviceName: deviceName },
    });

    return updated.count > 0;
  }

  async getPreferredDeviceId(worldSlug: string): Promise<string | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { spotifyConnection: { select: { preferredDeviceId: true } } },
    });

    return world?.spotifyConnection?.preferredDeviceId ?? null;
  }

  async saveConnection(input: SaveSpotifyConnectionInput): Promise<void> {
    const accessTokenEncrypted = encryptSecret(input.tokens.accessToken, this.encryptionSecret);
    const refreshTokenEncrypted = encryptSecret(
      input.tokens.refreshToken,
      this.encryptionSecret,
    );

    await this.db.spotifyConnection.upsert({
      where: { worldId: input.worldId },
      create: {
        worldId: input.worldId,
        spotifyUserId: input.spotifyUserId,
        spotifyDisplayName: input.spotifyDisplayName ?? null,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        expiresAt: input.tokens.expiresAt,
        scopes: input.tokens.scope,
      },
      update: {
        spotifyUserId: input.spotifyUserId,
        spotifyDisplayName: input.spotifyDisplayName ?? null,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        expiresAt: input.tokens.expiresAt,
        scopes: input.tokens.scope,
      },
    });
  }

  async disconnectByWorldSlug(worldSlug: string): Promise<boolean> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });

    if (!world) {
      return false;
    }

    await this.db.spotifyConnection.deleteMany({
      where: { worldId: world.id },
    });

    return true;
  }

  async getValidAccessTokenByWorldSlug(worldSlug: string): Promise<string | null> {
    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: {
        id: true,
        spotifyConnection: true,
      },
    });

    if (!world?.spotifyConnection) {
      return null;
    }

    const connection = world.spotifyConnection;
    const refreshToken = decryptSecret(
      connection.refreshTokenEncrypted,
      this.encryptionSecret,
    );

    if (!shouldRefreshSpotifyToken(connection.expiresAt)) {
      return decryptSecret(connection.accessTokenEncrypted, this.encryptionSecret);
    }

    const refreshed = await refreshSpotifyAccessToken(
      this.oauthConfig,
      refreshToken,
    );

    if (!refreshed.ok) {
      await this.db.spotifyConnection.delete({ where: { worldId: world.id } });
      return null;
    }

    const nextRefreshToken = refreshed.refreshToken ?? refreshToken;
    await this.db.spotifyConnection.update({
      where: { worldId: world.id },
      data: {
        accessTokenEncrypted: encryptSecret(refreshed.accessToken, this.encryptionSecret),
        refreshTokenEncrypted: encryptSecret(nextRefreshToken, this.encryptionSecret),
        expiresAt: refreshed.expiresAt,
      },
    });

    return refreshed.accessToken;
  }
}

export function createSpotifyConnectionService(
  db: PrismaClient,
  oauthConfig: SpotifyOAuthConfig,
): SpotifyConnectionService {
  return new SpotifyConnectionService(db, oauthConfig);
}

export function resolveSpotifyOAuthConfig(): SpotifyOAuthConfig | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI?.trim() ??
    (process.env.NEXT_PUBLIC_STUDIO_URL
      ? `${process.env.NEXT_PUBLIC_STUDIO_URL.replace(/\/$/, "")}/api/spotify/callback`
      : undefined);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function isSpotifyOAuthConfigured(): boolean {
  return resolveSpotifyOAuthConfig() !== null;
}
