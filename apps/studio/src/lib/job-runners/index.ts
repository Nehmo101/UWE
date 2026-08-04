/**
 * Job-Runner, nach Domäne geteilt: `backup`, `import`, `ai`, `mail` — plus die
 * Integrations-Runner (`../integration-job-runners`). Diese Datei behält nur
 * die Dispatch-Map; die Payload-Typen leben intern bei ihren Runnern.
 */
import { runBriefingJob, runCalendarSyncJob, runImageStudioJob, runMailSyncJob, runResearchJob } from "../integration-job-runners";
import { runAiRunJob, runCanonCheckJob, runEmbeddingJob, runReindexJob } from "./ai";
import { runBackupJob, runBackupRestoreJob } from "./backup";
import { runImportJob } from "./import";
import { runMailSendJob } from "./mail";
import type { JobRunnerContext } from "./context";

export type { JobRunnerContext } from "./context";

export async function executeJobRunners(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  switch (ctx.job.type) {
    case "backup":
      return runBackupJob(ctx);
    case "import":
      return runImportJob(ctx);
    case "ai_run":
      return runAiRunJob(ctx);
    case "mail_send":
      return runMailSendJob(ctx);
    case "mail_sync":
      return runMailSyncJob(ctx);
    case "embedding":
      return runEmbeddingJob(ctx);
    case "reindex":
      return runReindexJob(ctx);
    case "canon_check":
      return runCanonCheckJob(ctx);
    case "backup_restore":
      return runBackupRestoreJob(ctx);
    case "image_studio":
      return runImageStudioJob(ctx);
    case "calendar_sync":
      return runCalendarSyncJob(ctx);
    case "research":
      return runResearchJob(ctx);
    case "briefing":
      return runBriefingJob(ctx);
    default:
      throw new Error(`Unbekannter Job-Typ: ${ctx.job.type}`);
  }
}
