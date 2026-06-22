"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import Link from "next/link";
import { useEffect, useState } from "react";

export function StudioLoginFooter() {
  const [setupAvailable, setSetupAvailable] = useState(false);

  useEffect(() => {
    void fetch(studioApiUrl("/api/auth/setup"))
      .then((response) => response.json())
      .then((payload: { setupAvailable?: boolean }) => {
        setSetupAvailable(Boolean(payload.setupAvailable));
      })
      .catch(() => setSetupAvailable(false));
  }, []);

  return (
    <>
      {setupAvailable && (
        <p className="studio-auth-footer">
          <Link href="/setup">Erstes Setup</Link>
        </p>
      )}
    </>
  );
}
