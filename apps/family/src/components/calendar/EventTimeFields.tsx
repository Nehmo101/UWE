"use client";

import { useState } from "react";

/**
 * Beginn, Ende und „Ganztägig" eines Termins.
 *
 * Wer eine Startzeit setzt, bekommt sofort ein Ende eine Stunde später — man
 * sieht die Vorbelegung also, statt sie beim Speichern zu erraten. Sie ist
 * jederzeit überschreibbar; ein selbst gesetztes Ende wird nicht angefasst,
 * solange es nach dem Beginn liegt.
 *
 * Ganztägig blendet das Ende aus: ein deaktiviertes Feld wird nicht mitgesendet,
 * der Termin landet ohne Ende in der Datenbank, und der ICS-Feed spannt den
 * ganzen Tag auf. Ein Häkchen zurück holt das vorige Ende wieder her.
 *
 * Die Stunde steht hier bewusst als eigene Zahl: der Client zieht sonst über den
 * `@uwe/family-core`-Barrel Server-Code ins Bundle. Verbindlich ist die
 * serverseitige Vorbelegung (`DEFAULT_EVENT_DURATION_MINUTES`, `resolveEventEnd`),
 * die für Formular, API und MCP gleichermaßen gilt.
 */

const DEFAULT_DURATION_MS = 60 * 60_000;

/** "YYYY-MM-DDTHH:mm" → Date (Host-Zeit), oder null bei Unfug. */
function parseLocal(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Das vorgeschlagene Ende zu einem Beginn — eine Stunde später. */
function defaultEnd(start: string): string {
  const parsed = parseLocal(start);
  return parsed ? toLocalInput(new Date(parsed.getTime() + DEFAULT_DURATION_MS)) : "";
}

/**
 * Behalten oder ersetzen: ein Ende, das nach dem Beginn liegt, bleibt stehen —
 * auch ein längeres. Ein leeres oder inzwischen überholtes Ende wird zur Stunde.
 */
function nextEnd(start: string, current: string): string {
  const startDate = parseLocal(start);
  if (!startDate) return current;
  const currentDate = parseLocal(current);
  if (currentDate && currentDate.getTime() > startDate.getTime()) return current;
  return defaultEnd(start);
}

export function EventTimeFields({
  startAt = "",
  endAt = "",
  allDay = false,
}: {
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}) {
  const [start, setStart] = useState(startAt);
  const [end, setEnd] = useState(endAt);
  const [wholeDay, setWholeDay] = useState(allDay);

  function handleStart(value: string) {
    setStart(value);
    if (!wholeDay) setEnd((current) => nextEnd(value, current));
  }

  function handleWholeDay(checked: boolean) {
    setWholeDay(checked);
    if (!checked) setEnd((current) => nextEnd(start, current));
  }

  return (
    <div className="family-form-row">
      <label>
        Beginn
        <input
          name="startAt"
          type="datetime-local"
          value={start}
          onChange={(event) => handleStart(event.target.value)}
          required
        />
      </label>
      <label>
        Ende
        <input
          name="endAt"
          type="datetime-local"
          value={wholeDay ? "" : end}
          onChange={(event) => setEnd(event.target.value)}
          disabled={wholeDay}
        />
      </label>
      <label className="family-check">
        <input
          name="allDay"
          type="checkbox"
          checked={wholeDay}
          onChange={(event) => handleWholeDay(event.target.checked)}
        />
        Ganztägig
      </label>
    </div>
  );
}
