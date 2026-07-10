// Thin re-export shim: the pure IMAP sync planner moved to the leaf package
// @uwe/mail-core. Kept here so the "@uwe/mail/sync" subpath export stays valid.
export {
  planImapSync,
  buildUidFetchChunks,
  type SyncPlanInput,
  type SyncPlan,
} from "@uwe/mail-core";
