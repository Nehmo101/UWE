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
      className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80"
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
