import { redirect } from "next/navigation";

/**
 * Legacy diagnose dashboard — consolidated into System-Hub (Phase C #638).
 * JSON API remains at /api/admin/status for programmatic consumers.
 */
export default function AdminStatusPage() {
  redirect("/system?tab=diagnose");
}
