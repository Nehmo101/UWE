"use client";

import type { PortalTreasuryView } from "@uwe/database/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

/**
 * Gruppen-Inventar im Tischmodus — nur lesen.
 *
 * Was hier steht, hat bereits die Spielersicht passiert: `getForViewer`
 * entfernt GM-Gegenstände, bevor der Abzug entsteht.
 */

interface Props {
  treasury: PortalTreasuryView | null;
}

export function TreasuryCard({ treasury }: Props) {
  if (!treasury || treasury.items.length === 0) {
    return <p className="text-sm text-muted-foreground">Kein Gruppen-Inventar im Abzug.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{treasury.name}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <ul className="grid gap-1 text-sm">
          {treasury.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.name}
                {item.notes.trim() ? (
                  <span className="block text-xs text-muted-foreground">{item.notes}</span>
                ) : null}
              </span>
              <span className="tabular-nums text-muted-foreground">×{item.quantity}</span>
            </li>
          ))}
        </ul>

        {treasury.notes.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{treasury.notes}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
