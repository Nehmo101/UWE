"use client";

import { ErrorScreen } from "@/src/components/system/ErrorScreen";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} />;
}
