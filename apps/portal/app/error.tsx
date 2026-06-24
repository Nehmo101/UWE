"use client";

import { ErrorAlert } from "@uwe/shared-ui";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page">
      <ErrorAlert
        title="Etwas ist schiefgelaufen"
        message={error.message || "Die Seite konnte nicht geladen werden."}
        action={
          <button type="button" className="uwe-v2-btn uwe-v2-btn-primary" onClick={reset}>
            Erneut versuchen
          </button>
        }
      />
    </div>
  );
}
