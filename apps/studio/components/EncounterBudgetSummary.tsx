"use client";

import { useMemo } from "react";
import {
  analyzeEncounterXp,
  ENCOUNTER_DIFFICULTY_LABELS,
  getEncounterBudgetThresholds,
} from "@uwe/dnd-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface Props {
  partyLevel: number;
  partySize: number;
  monsters: Array<{ cr?: string; count?: number }>;
}

export function EncounterBudgetSummary({ partyLevel, partySize, monsters }: Props) {
  const thresholds = useMemo(
    () => getEncounterBudgetThresholds(partyLevel, partySize),
    [partyLevel, partySize],
  );
  const analysis = useMemo(
    () => analyzeEncounterXp({ partyLevel, partySize, monsters }),
    [partyLevel, partySize, monsters],
  );

  if (monsters.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Party-Budget (Lv {partyLevel}, {partySize} Spieler): leicht {thresholds.easy} · mittel{" "}
        {thresholds.medium} · schwer {thresholds.hard} · tödlich {thresholds.deadly} XP
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>CR/XP-Budget</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p>
          Roh-XP: {analysis.rawXp} · Multiplikator ×{analysis.multiplier} · Angepasst:{" "}
          <strong>{analysis.adjustedXp} XP</strong> —{" "}
          <strong>{ENCOUNTER_DIFFICULTY_LABELS[analysis.difficulty]}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          Budget: leicht {thresholds.easy} · mittel {thresholds.medium} · schwer {thresholds.hard} ·
          tödlich {thresholds.deadly} XP
        </p>
      </CardContent>
    </Card>
  );
}
