-- Atlas World Builder: maps, nodes, features, objects, palette items

-- CreateTable
CREATE TABLE "atlas_maps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Atlas',
    "style_preset" TEXT NOT NULL DEFAULT 'tolkien-ink',
    "settings" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas_maps_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "map_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "parent_feature_id" TEXT,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "extent" JSONB,
    "silhouette" JSONB,
    "seed" INTEGER,
    "background_asset_id" TEXT,
    "page_id" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas_nodes_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "atlas_maps" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atlas_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "atlas_nodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atlas_nodes_parent_feature_id_fkey" FOREIGN KEY ("parent_feature_id") REFERENCES "atlas_features" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atlas_nodes_background_asset_id_fkey" FOREIGN KEY ("background_asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atlas_nodes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas_features" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "style" JSONB,
    "label_text" TEXT,
    "label_color" TEXT,
    "child_node_id" TEXT,
    "linked_page_id" TEXT,
    "layer" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas_features_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atlas_features_child_node_id_fkey" FOREIGN KEY ("child_node_id") REFERENCES "atlas_nodes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "atlas_features_linked_page_id_fkey" FOREIGN KEY ("linked_page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas_objects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "palette_item_id" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "scale" REAL NOT NULL DEFAULT 1,
    "rotation" REAL NOT NULL DEFAULT 0,
    "layer" INTEGER NOT NULL DEFAULT 0,
    "linked_page_id" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas_objects_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "atlas_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atlas_objects_palette_item_id_fkey" FOREIGN KEY ("palette_item_id") REFERENCES "atlas_palette_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "atlas_objects_linked_page_id_fkey" FOREIGN KEY ("linked_page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atlas_palette_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'builtin',
    "asset_id" TEXT,
    "builtin_glyph_key" TEXT,
    "review_status" TEXT NOT NULL DEFAULT 'approved',
    "style_tags" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "atlas_palette_items_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "atlas_palette_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "atlas_maps_world_id_key" ON "atlas_maps"("world_id");

-- CreateIndex
CREATE INDEX "atlas_nodes_map_id_sort_order_idx" ON "atlas_nodes"("map_id", "sort_order");

-- CreateIndex
CREATE INDEX "atlas_nodes_parent_id_idx" ON "atlas_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "atlas_features_node_id_layer_sort_order_idx" ON "atlas_features"("node_id", "layer", "sort_order");

-- CreateIndex
CREATE INDEX "atlas_objects_node_id_layer_idx" ON "atlas_objects"("node_id", "layer");

-- CreateIndex
CREATE INDEX "atlas_palette_items_world_id_kind_idx" ON "atlas_palette_items"("world_id", "kind");

-- CreateIndex
CREATE INDEX "atlas_palette_items_review_status_idx" ON "atlas_palette_items"("review_status");
