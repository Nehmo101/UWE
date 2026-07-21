-- Atlas 3D foundation: fresh world-builder tables (no visibility columns by owner decision 2026-07-21)

-- CreateTable
CREATE TABLE "atlas3d_worlds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Atlas 3D',
    "style_preset" TEXT NOT NULL DEFAULT 'pergament',
    "environment" JSONB,
    "projection" JSONB,
    "seed" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas3d_worlds_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas3d_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "atlas_world_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "extent" JSONB,
    "silhouette" JSONB,
    "seed" INTEGER NOT NULL DEFAULT 1,
    "environment" JSONB,
    "style_preset_override" TEXT,
    "page_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas3d_nodes_atlas_world_id_fkey" FOREIGN KEY ("atlas_world_id") REFERENCES "atlas3d_worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atlas3d_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "atlas3d_nodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atlas3d_nodes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas3d_terrains" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "heightmap_asset_id" TEXT,
    "splatmap_asset_id" TEXT,
    "carve_ops" JSONB,
    "meta" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas3d_terrains_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas3d_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atlas3d_terrains_heightmap_asset_id_fkey" FOREIGN KEY ("heightmap_asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atlas3d_terrains_splatmap_asset_id_fkey" FOREIGN KEY ("splatmap_asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas3d_features" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "style" JSONB,
    "label_text" TEXT,
    "child_node_id" TEXT,
    "linked_page_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas3d_features_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas3d_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atlas3d_features_child_node_id_fkey" FOREIGN KEY ("child_node_id") REFERENCES "atlas3d_nodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atlas3d_features_linked_page_id_fkey" FOREIGN KEY ("linked_page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas3d_objects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "asset_kind" TEXT NOT NULL,
    "asset_params" JSONB,
    "position" JSONB NOT NULL,
    "scale" REAL NOT NULL DEFAULT 1,
    "rotation" REAL NOT NULL DEFAULT 0,
    "tint" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas3d_objects_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas3d_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas3d_camera_bookmarks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pose" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas3d_camera_bookmarks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas3d_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);



-- CreateIndex
CREATE UNIQUE INDEX "atlas3d_worlds_world_id_key" ON "atlas3d_worlds"("world_id");

-- CreateIndex
CREATE INDEX "atlas3d_nodes_parent_id_idx" ON "atlas3d_nodes"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "atlas3d_nodes_atlas_world_id_slug_key" ON "atlas3d_nodes"("atlas_world_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "atlas3d_terrains_node_id_key" ON "atlas3d_terrains"("node_id");

-- CreateIndex
CREATE INDEX "atlas3d_features_node_id_kind_idx" ON "atlas3d_features"("node_id", "kind");

-- CreateIndex
CREATE INDEX "atlas3d_objects_node_id_asset_kind_idx" ON "atlas3d_objects"("node_id", "asset_kind");

