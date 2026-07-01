import type { CanonicalStatus } from "./generated/prisma/client";

/** Kanon-Lifecycle-Status für Studio-Filter (B5). */
export const CANONICAL_LIFECYCLE_FILTER_STATUSES = [
  "prepared",
  "played",
  "discarded",
  "draft",
  "canon",
  "idea",
] as const satisfies readonly CanonicalStatus[];

export type CanonicalLifecycleFilterStatus =
  (typeof CANONICAL_LIFECYCLE_FILTER_STATUSES)[number];

export function isCanonicalLifecycleFilterStatus(
  value: string | undefined,
): value is CanonicalLifecycleFilterStatus {
  if (!value) return false;
  return (CANONICAL_LIFECYCLE_FILTER_STATUSES as readonly string[]).includes(value);
}
