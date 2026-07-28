import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildStorageKey,
  ensureUploadDirectory,
  resolveAssetFilePath,
} from "@uwe/assets";
import {
  createAuthService,
  createPrismaClient,
  createUweRepository,
  type AuthService,
  type PrismaClient,
  type UweRepository,
} from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { SECURITY_MARKERS } from "../markers";

export interface SecurityFixtureUsers {
  owner: { id: string; email: string };
  admin: { id: string; email: string };
  dm: { id: string; email: string };
  player: { id: string; email: string };
}

export interface SecurityFixtureContent {
  publicWorldSlug: string;
  privateWorldSlug: string;
  slugs: {
    publicPage: string;
    playerVisiblePage: string;
    dmOnlyPage: string;
    hiddenSecretPage: string;
    revealedSecretPage: string;
  };
  assetIds: {
    publicMedia: string;
    privateMedia: string;
  };
}

export interface SecurityFixture {
  databaseUrl: string;
  uploadsRoot: string;
  db: PrismaClient;
  repo: UweRepository;
  auth: AuthService;
  users: SecurityFixtureUsers;
  content: SecurityFixtureContent;
  cleanup: () => Promise<void>;
}

const TEST_PASSWORD = "uwe-security-test";

/**
 * Seeds two worlds (public + private) with labeled content for security tests.
 *
 * There is no role enum any more (see docs/engineering/access-model.md). The
 * fixture seeds the three shapes the model allows:
 * - owner  → owner flag plus all four checkboxes
 * - dm     → Studio checkbox, reaches every world
 * - player → Portal checkbox, assigned to the public world only
 * - anonymous → no session, sees nothing
 */
export async function createSecurityFixture(): Promise<SecurityFixture> {
  const databaseUrl = createTestDatabaseUrl();
  const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-sec-uploads-"));
  process.env.UWE_UPLOADS_ROOT = uploadsRoot;

  const db = createPrismaClient(databaseUrl);
  const repo = createUweRepository(databaseUrl);
  const auth = createAuthService(db);

  const publicWorld = await repo.createWorld({
    name: "Security Public World",
    slug: "sec-public-world",
    description: "Guest-enabled world for leak tests",
  });

  const privateWorld = await repo.createWorld({
    name: "Security Private World",
    slug: "sec-private-world",
    description: "Guest-disabled world with DM-only content",
  });


  const owner = await auth.createUser({
    displayName: "Security Owner",
    email: "sec-owner@uwe.local",
    password: TEST_PASSWORD,
    isOwner: true,
    portalAccess: true,
    studioAccess: true,
    brainAccess: true,
    familyAccess: true,
  });
  await auth.createWorldMembership({
    userId: owner.id,
    worldId: publicWorld.id,
  });
  await auth.createWorldMembership({
    userId: owner.id,
    worldId: privateWorld.id,
  });

  const admin = await auth.createUser({
    displayName: "Security Admin",
    email: "sec-admin@uwe.local",
    password: TEST_PASSWORD,
    isOwner: true,
    portalAccess: true,
    studioAccess: true,
    brainAccess: true,
    familyAccess: true,
  });
  await auth.createWorldMembership({
    userId: admin.id,
    worldId: publicWorld.id,
  });

  const dm = await auth.createUser({
    displayName: "Security DM",
    email: "sec-dm@uwe.local",
    password: TEST_PASSWORD,
    portalAccess: true,
    studioAccess: true,
  });
  await auth.createWorldMembership({
    userId: dm.id,
    worldId: publicWorld.id,
  });
  await auth.createWorldMembership({
    userId: dm.id,
    worldId: privateWorld.id,
  });

  const player = await auth.createUser({
    displayName: "Security Player",
    email: "sec-player@uwe.local",
    password: TEST_PASSWORD,
    portalAccess: true,
    studioAccess: false,
  });
  await auth.createWorldMembership({
    userId: player.id,
    worldId: publicWorld.id,
    characterName: "Testspieler",
  });

  const slugs = {
    publicPage: "oeffentliche-notiz",
    playerVisiblePage: "spieler-sichtbar",
    dmOnlyPage: "nur-dm",
    hiddenSecretPage: "verborgenes-geheimnis",
    revealedSecretPage: "enthuelltes-geheimnis",
  };

  await repo.createPage({
    worldId: publicWorld.id,
    title: "Öffentliche Notiz",
    slug: slugs.publicPage,
    type: "note",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content: SECURITY_MARKERS.PUBLIC,
      },
    ],
  });

  await repo.createPage({
    worldId: publicWorld.id,
    title: "Spieler sichtbar",
    slug: slugs.playerVisiblePage,
    type: "note",
    contentBlocks: [
      {
        type: "player_text",
        sortOrder: 0,
        content: SECURITY_MARKERS.PLAYER_VISIBLE,
      },
    ],
  });

  await repo.createPage({
    worldId: publicWorld.id,
    title: "Nur DM",
    slug: slugs.dmOnlyPage,
    type: "lore",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content: SECURITY_MARKERS.DM_ONLY,
      },
    ],
  });

  const hiddenSecret = await repo.createPage({
    worldId: publicWorld.id,
    title: "Verborgenes Geheimnis",
    slug: slugs.hiddenSecretPage,
    type: "secret",
    contentBlocks: [
      {
        type: "player_text",
        sortOrder: 0,
        content: SECURITY_MARKERS.HIDDEN_SECRET,
      },
    ],
  });

  await repo.createPage({
    worldId: publicWorld.id,
    title: "Enthülltes Geheimnis",
    slug: slugs.revealedSecretPage,
    type: "secret",
    contentBlocks: [
      {
        type: "player_text",
        sortOrder: 0,
        content: SECURITY_MARKERS.REVEALED_SECRET,
      },
    ],
  });

  await repo.createPage({
    worldId: privateWorld.id,
    title: "Private Welt DM-only",
    slug: "private-dm-only",
    type: "lore",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        content: SECURITY_MARKERS.DM_ONLY,
      },
    ],
  });

  ensureUploadDirectory(publicWorld.id, uploadsRoot);

  const publicStorageKey = buildStorageKey(publicWorld.id, "public-banner.png");
  fs.writeFileSync(
    resolveAssetFilePath(publicStorageKey, uploadsRoot),
    SECURITY_MARKERS.PUBLIC,
  );

  const privateStorageKey = buildStorageKey(publicWorld.id, "secret-map.png");
  fs.writeFileSync(
    resolveAssetFilePath(privateStorageKey, uploadsRoot),
    SECURITY_MARKERS.PRIVATE_MEDIA,
  );

  const publicMedia = await repo.createAsset({
    worldId: publicWorld.id,
    title: "Public Banner",
    type: "image",
    storageKey: publicStorageKey,
    mimeType: "image/png",
    size: SECURITY_MARKERS.PUBLIC.length,
  });

  const privateMedia = await repo.createAsset({
    worldId: publicWorld.id,
    title: "Secret Map",
    type: "map",
    storageKey: privateStorageKey,
    mimeType: "image/png",
    size: SECURITY_MARKERS.PRIVATE_MEDIA.length,
  });

  void hiddenSecret;

  const content: SecurityFixtureContent = {
    publicWorldSlug: publicWorld.slug,
    privateWorldSlug: privateWorld.slug,
    slugs,
    assetIds: {
      publicMedia: publicMedia.id,
      privateMedia: privateMedia.id,
    },
  };

  const users: SecurityFixtureUsers = {
    owner: { id: owner.id, email: owner.email! },
    admin: { id: admin.id, email: admin.email! },
    dm: { id: dm.id, email: dm.email! },
    player: { id: player.id, email: player.email! },
  };

  const cleanup = async () => {
    await db.$disconnect();
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
    delete process.env.UWE_UPLOADS_ROOT;
  };

  return { databaseUrl, uploadsRoot, db, repo, auth, users, content, cleanup };
}
