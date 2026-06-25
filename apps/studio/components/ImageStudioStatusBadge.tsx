import type { ImageStudioStatus } from "@uwe/database/server";
import { imageStudioStatusBadgeClass } from "@/src/lib/image-studio-status-ui";

interface ImageStudioStatusBadgeProps {
  status: ImageStudioStatus;
  label: string;
}

export function ImageStudioStatusBadge({ status, label }: ImageStudioStatusBadgeProps) {
  return <span className={imageStudioStatusBadgeClass(status)}>{label}</span>;
}
