import type { ImageStudioStatus } from "./generated/prisma/client";

export type { ImageStudioStatus } from "./generated/prisma/client";

export const IMAGE_STUDIO_STATUS_LABELS: Record<ImageStudioStatus, string> = {
  draft: "Entwurf",
  processing: "In Bearbeitung",
  completed: "Fertig",
  failed: "Fehlgeschlagen",
};

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
