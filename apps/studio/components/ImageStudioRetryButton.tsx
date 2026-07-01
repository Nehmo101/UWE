"use client";

import { useTransition } from "react";
import { retryImageStudioProjectAction } from "@/app/integration-actions";

interface ImageStudioRetryButtonProps {
  projectId: string;
}

export function ImageStudioRetryButton({ projectId }: ImageStudioRetryButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="uwe-v2-btn uwe-v2-btn-secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const formData = new FormData();
          formData.set("projectId", projectId);
          await retryImageStudioProjectAction(formData);
        });
      }}
    >
      {pending ? "Wird wiederholt…" : "Job erneut starten"}
    </button>
  );
}
