"use client";

import { useMemo } from "react";
import {
  analyzeEncounterXp,
  ENCOUNTER_DIFFICULTY_LABELS,
  getEncounterBudgetThresholds,
} from "@uwe/dnd-api";

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
      <div className="uwe-hint">
        Party-Budget (Lv {partyLevel}, {partySize} Spieler): leicht {thresholds.easy} · mittel{" "}
        {thresholds.medium} · schwer {thresholds.hard} · tödlich {thresholds.deadly} XP
      </div>
    );
  }

  return (
    <div className="uwe-v2-card uwe-v2-card-padded" style={{ marginTop: "1rem" }}>
      <h3>CR/XP-Budget</h3>
      <p>
        Roh-XP: {analysis.rawXp} · Multiplikator ×{analysis.multiplier} · Angepasst:{" "}
        <strong>{analysis.adjustedXp} XP</strong> —{" "}
        <strong>{ENCOUNTER_DIFFICULTY_LABELS[analysis.difficulty]}</strong>
      </p>
      <p className="uwe-hint">
        Budget: leicht {thresholds.easy} · mittel {thresholds.medium} · schwer {thresholds.hard} ·
        tödlich {thresholds.deadly} XP
      </p>
    </div>
  );
}
