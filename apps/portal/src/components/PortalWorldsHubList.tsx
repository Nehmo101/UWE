"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  isWorldNewSinceLastVisit,
  readPortalWorldVisits,
  writePortalWorldVisit,
} from "@/src/lib/world-visit-tracking";

export interface PortalWorldHubEntry {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  updatedAt: string;
}

interface PortalWorldsHubListProps {
  worlds: PortalWorldHubEntry[];
}

export function PortalWorldsHubList({ worlds }: PortalWorldsHubListProps) {
  const [visits, setVisits] = useState<Record<string, string>>({});

  useEffect(() => {
    setVisits(readPortalWorldVisits());
  }, []);

  const worldsWithActivity = useMemo(
    () =>
      worlds.map((world) => ({
        ...world,
        isNew: isWorldNewSinceLastVisit(world.updatedAt, visits[world.id]),
      })),
    [worlds, visits],
  );

  function handleWorldOpen(worldId: string) {
    writePortalWorldVisit(worldId);
    setVisits(readPortalWorldVisits());
  }

  return (
    <ul className="auth-world-list">
      {worldsWithActivity.map((world) => (
        <li key={world.id}>
          <Link
            href={`/auth/worlds/${world.slug}`}
            onClick={() => handleWorldOpen(world.id)}
          >
            <strong>{world.name}</strong>
            {world.description ? <span>{world.description}</span> : null}
            <span className="auth-page-list-badges">
              {world.isNew ? (
                <span className="uwe-badge portal-new-badge">Neu seit deinem letzten Besuch</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
