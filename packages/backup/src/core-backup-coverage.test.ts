import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRISMA_MODEL_BOUNDARIES } from "@uwe/product-contracts";

/**
 * Abdeckungs-Ratchet für die Kern-DB (uwe.db), Gegenstück zu
 * brain-export.test.ts / family-export.test.ts.
 *
 * Der Atlas-Abbau hat gezeigt, dass Modelle außerhalb von data.json nach einer
 * destruktiven Migration unwiederbringlich sind (terra-runde-j-atlas-abbau.md,
 * Vorabbefund 1) — und dass es "für die Modelle in uwe.db kein Analogon" zum
 * Brain-Vollständigkeitstest gab. Das hier ist dieses Analogon in Ratchet-Form:
 * JEDES uwe.db-Modell muss entweder im Backup stecken (BACKED_UP_CORE_MODELS)
 * oder BEWUSST auf der Ausschlussliste stehen. Ein neues Modell lässt den Test
 * fehlschlagen, bis es triagiert wurde.
 */

/** BackupData-Sektionen in collect.ts, als Prisma-Modellnamen. */
const BACKED_UP_CORE_MODELS = new Set([
  "World", "Campaign", "Page", "ContentBlock", "PageLink", "Asset", "AssetPageLink",
  "GameSession", "GameSessionPageLink", "LabelTemplate", "Label", "PrintList",
  "PrintListItem", "SoundboardButton", "SoundboardButtonPageLink", "WorldMembership",
  "User", "PageTemplate", "PlayerNote", "TerraKarte",
]);

/**
 * Bewusst NICHT im logischen Backup. Zwei Klassen:
 * - flüchtig/ableitbar (Sessions, Challenges, Caches, Logs, Job-Zustände) —
 *   gehören nie in ein Backup;
 * - ECHTE LÜCKEN (mit "GAP:" markiert) — Inhalte, die aktuell nur der rohe
 *   SQLite-Snapshot (deploy/scripts/uwe-backup.sh bzw. Datei-Kopie) sichert.
 *   Wer eine GAP-Zeile entfernt, muss das Modell in collect.ts aufnehmen.
 */
const CORE_MODELS_NOT_BACKED_UP = new Set([
  // flüchtig / ableitbar / operativ
  "ActivityLog", "AiApplyLog", "AiRun", "AiUsageLog", "ApiTokenUsageLog", "AuditLog",
  "AuthIdentity", "BugReport", "Connector", "ConnectorJob",
  "DndApiCacheEntry", "ImportJob", "Job", "JobLog", "PageVersion", "SecurityWarning",
  "SeedHistory", "Session", "TwoFactorChallenge", "UndoEntry", "WebAuthnChallenge",
  "WebhookDelivery",
  // Credentials/Integrationen — nach Restore neu verbinden statt sichern
  "ApiToken", "ApiTokenScope", "SpotifyConnection", "TwoFactorSecret",
  "WebAuthnCredential",
  // Konfiguration, die der Betreiber neu setzt bzw. settings.json abdeckt
  "AiGatewayConfig", "ConnectorWorkflowDefault", "DashboardLayout",
  "InferenceEndpoint", "SystemSettings", "WebhookEndpoint",
  // GAP: Welt-/Kampagnen-Inhalte ohne logisches Backup (nur Roh-Snapshot!)
  "AiProposal", // GAP
  "AssetAlbum", // GAP
  "AssetAlbumItem", // GAP
  "BrainChunk", // GAP
  "BrainDocument", // GAP
  "BrainFact", // GAP
  "BrainLink", // GAP
  "Character", // GAP
  "CharacterSpell", // GAP
  "DevIdea", // GAP
  "DndBeyondReference", // GAP
  "EntityTag", // GAP
  "FactionState", // GAP
  "GeneratorOutput", // GAP
  "GeneratorPreset", // GAP
  "ImageStudioLink", // GAP
  "ImageStudioProject", // GAP
  "ImageStudioVersion", // GAP
  "InventoryItem", // GAP
  "PartyTreasury", // GAP
  "PlayerQuestFlag", // GAP
  "PlayerQuestion", // GAP
  "PromptTemplate", // GAP
  "RollTable", // GAP
  "SessionAvailability", // GAP
  "SessionLiveEntry", // GAP
  "StructuredItem", // GAP
  "StructuredStatblock", // GAP
  "Tag", // GAP
  "WorldCalendar", // GAP
  "WorldEvent", // GAP
  "WorldEventEntityLink", // GAP
]);

describe("core backup coverage ratchet (uwe.db)", () => {
  const coreModels = Object.entries(PRISMA_MODEL_BOUNDARIES)
    .filter(([, boundary]) => boundary.targetDatabase === "uwe.db")
    .map(([name]) => name);

  it("every uwe.db model is either backed up or consciously excluded", () => {
    const untriaged = coreModels.filter(
      (name) => !BACKED_UP_CORE_MODELS.has(name) && !CORE_MODELS_NOT_BACKED_UP.has(name),
    );
    assert.deepEqual(
      untriaged,
      [],
      `Neue uwe.db-Modelle ohne Backup-Triage: ${untriaged.join(", ")} — ` +
        "entweder in collect.ts aufnehmen (BACKED_UP_CORE_MODELS ergänzen) oder " +
        "hier bewusst ausschließen.",
    );
  });

  it("the two lists do not overlap and contain no stale names", () => {
    const coreSet = new Set(coreModels);
    for (const name of BACKED_UP_CORE_MODELS) {
      assert.equal(coreSet.has(name), true, `${name} ist kein uwe.db-Modell mehr`);
      assert.equal(CORE_MODELS_NOT_BACKED_UP.has(name), false, `${name} steht in beiden Listen`);
    }
    for (const name of CORE_MODELS_NOT_BACKED_UP) {
      assert.equal(coreSet.has(name), true, `${name} ist kein uwe.db-Modell mehr`);
    }
  });
});
