-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "page_key" TEXT NOT NULL,
    "widgets" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dashboard_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_user_id_page_key_key" ON "dashboard_layouts"("user_id", "page_key");

-- CreateIndex
CREATE INDEX "dashboard_layouts_user_id_idx" ON "dashboard_layouts"("user_id");
