// Thin re-export shim: the priority scorer moved to the leaf package
// @uwe/mail-core. Kept here so the "@uwe/mail/priority" subpath export stays
// valid for existing consumers.
export {
  scoreMailPriority,
  type MailPriorityInput,
  type MailPriorityResult,
} from "@uwe/mail-core";
