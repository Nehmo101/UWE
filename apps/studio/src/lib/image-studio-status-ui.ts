import type { ImageStudioStatus } from "@uwe/database/server";

export function imageStudioStatusBadgeClass(status: ImageStudioStatus): string {
  switch (status) {
    case "completed":
      return "uwe-badge uwe-badge-success";
    case "processing":
      return "uwe-badge uwe-badge-warning";
    case "failed":
      return "uwe-badge uwe-badge-danger";
    default:
      return "uwe-badge";
  }
}
