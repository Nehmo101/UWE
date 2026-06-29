"use client";

import { PortalErrorScreen } from "@/src/components/PortalErrorScreen";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PortalErrorScreen error={error} reset={reset} />;
}
