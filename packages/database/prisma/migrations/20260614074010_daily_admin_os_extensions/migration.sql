-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contract_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "expense_type" TEXT NOT NULL DEFAULT 'other',
    "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
    "category_label" TEXT NOT NULL DEFAULT '',
    "amount_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billing_day" INTEGER,
    "start_date" DATETIME,
    "next_payment_date" DATETIME,
    "renewal_date" DATETIME,
    "cancel_by_date" DATETIME,
    "portal_url" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_contract_expenses" ("amount_cents", "billing_day", "cancel_by_date", "created_at", "currency", "expense_type", "id", "metadata", "name", "notes", "renewal_date", "status", "updated_at", "vendor") SELECT "amount_cents", "billing_day", "cancel_by_date", "created_at", "currency", "expense_type", "id", "metadata", "name", "notes", "renewal_date", "status", "updated_at", "vendor" FROM "contract_expenses";
DROP TABLE "contract_expenses";
ALTER TABLE "new_contract_expenses" RENAME TO "contract_expenses";
CREATE INDEX "contract_expenses_status_idx" ON "contract_expenses"("status");
CREATE INDEX "contract_expenses_expense_type_idx" ON "contract_expenses"("expense_type");
CREATE INDEX "contract_expenses_renewal_date_idx" ON "contract_expenses"("renewal_date");
CREATE INDEX "contract_expenses_next_payment_date_idx" ON "contract_expenses"("next_payment_date");
CREATE TABLE "new_hardware_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "hostname" TEXT,
    "ip_address" TEXT,
    "local_url" TEXT,
    "public_url" TEXT,
    "operating_system" TEXT NOT NULL DEFAULT '',
    "specs" JSONB,
    "setup_steps" JSONB,
    "error_notes" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_hardware_devices" ("created_at", "error_notes", "hostname", "id", "ip_address", "metadata", "name", "notes", "role", "setup_steps", "specs", "status", "updated_at") SELECT "created_at", "error_notes", "hostname", "id", "ip_address", "metadata", "name", "notes", "role", "setup_steps", "specs", "status", "updated_at" FROM "hardware_devices";
DROP TABLE "hardware_devices";
ALTER TABLE "new_hardware_devices" RENAME TO "hardware_devices";
CREATE INDEX "hardware_devices_status_idx" ON "hardware_devices"("status");
CREATE INDEX "hardware_devices_role_idx" ON "hardware_devices"("role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
