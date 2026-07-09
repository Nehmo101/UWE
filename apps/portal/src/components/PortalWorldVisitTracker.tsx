"use client";

import { useEffect } from "react";
import { writePortalWorldVisit } from "@/src/lib/world-visit-tracking";

interface PortalWorldVisitTrackerProps {
  worldId: string;
}

/** Records a world visit in localStorage for hub "new since last visit" badges. */
export function PortalWorldVisitTracker({ worldId }: PortalWorldVisitTrackerProps) {
  useEffect(() => {
    writePortalWorldVisit(worldId);
  }, [worldId]);

  return null;
}
