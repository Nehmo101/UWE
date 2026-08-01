-- Cursor Agent Jobs entfernt.
--
-- `dev_agent_jobs` war die Warteschlange fuer Entwicklungs-Prompts, die UWE aus
-- dem Studio-Admin an GitHub Actions (`cursor-agent.yml`), an die Cursor-Cloud-
-- Agents-API oder als Merkposten an die lokale Cursor-CLI weitergereicht hat.
-- Der Weg laeuft jetzt komplett ausserhalb von UWE ueber GitHub; die Tabelle
-- hat damit keinen Schreiber und keinen Leser mehr.
--
-- `dev_ideas.dev_agent_job_id` war die einzige Verbindung zwischen einer Idee
-- und so einem Job ("An Cursor uebergeben"). Ideen, Chat-Verlauf und der
-- erzeugte Prompt bleiben unveraendert erhalten — nur die Uebergabe faellt weg,
-- der Prompt wird kopiert statt abgeschickt.
--
-- Beides ist operative Laufzeit-Historie und laut
-- `packages/backup/src/core-backup-coverage.test.ts` bewusst nicht Teil des
-- Backups — es geht hier also kein sicherungswuerdiger Inhalt verloren.

-- AlterTable
ALTER TABLE "dev_ideas" DROP COLUMN "dev_agent_job_id";

-- DropTable
DROP TABLE "dev_agent_jobs";

-- Der Job-Typ `agent_job` faellt aus dem `JobType`-Enum. Die Warteschlange
-- hat fuer ihn keinen Runner mehr, und die Job-Liste hat solche Zeilen bisher
-- ohnehin ausgeblendet — ohne dieses DELETE wuerden sie ab jetzt sichtbar und
-- unlaufbar in `/jobs` stehen.
DELETE FROM "jobs" WHERE "type" = 'agent_job';
