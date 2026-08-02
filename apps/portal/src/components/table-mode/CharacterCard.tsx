"use client";

import type { PortalCharacterView } from "@uwe/database/server";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

/**
 * Charakterbogen im Tischmodus — nur lesen.
 *
 * Bewusst nicht `CharacterSheetPanel`: das Panel hängt an Server Actions, die
 * ohne Netz nicht laufen. Hier steht deshalb das, was man am Tisch wirklich
 * nachschlägt — Werte, Rettungswürfe, Fertigkeiten, vorbereitete Zauber.
 */

const ABILITY_LABELS: Record<string, string> = {
  strength: "STÄ",
  dexterity: "GES",
  constitution: "KON",
  intelligence: "INT",
  wisdom: "WEI",
  charisma: "CHA",
};

function withSign(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

interface Props {
  character: PortalCharacterView;
}

export function CharacterCard({ character }: Props) {
  const sheet = character.sheet;
  const prepared = character.spells.filter((spell) => spell.prepared);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{character.displayName}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Stufe {sheet.level} · RK {sheet.armorClass ?? "—"} · Init {withSign(sheet.initiative)} ·
            ÜB {withSign(sheet.proficiencyBonus)}
          </p>
        </div>
        <Badge variant="secondary">
          {sheet.combat.currentHp ?? "—"}/{sheet.combat.maxHp ?? "—"} TP
        </Badge>
      </CardHeader>

      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Object.entries(ABILITY_LABELS).map(([key, label]) => {
            const score = sheet.abilities[key as keyof typeof sheet.abilities];
            const modifier = sheet.modifiers[key as keyof typeof sheet.modifiers];
            return (
              <div key={key} className="rounded-[var(--radius)] border border-border p-2 text-center">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold">{withSign(modifier)}</dd>
                <dd className="text-xs text-muted-foreground">{score}</dd>
              </div>
            );
          })}
        </dl>

        <p className="text-sm text-muted-foreground">
          Passive Wahrnehmung {sheet.derived.passivePerception} · Untersuchung{" "}
          {sheet.derived.passiveInvestigation} · Einsicht {sheet.derived.passiveInsight}
          {sheet.combat.speed ? ` · Bewegung ${sheet.combat.speed}` : ""}
        </p>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Rettungswürfe</h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {sheet.derived.savingThrows.map((save) => (
              <li
                key={save.ability}
                className="rounded-[var(--radius)] border border-border px-2 py-0.5"
              >
                {ABILITY_LABELS[save.ability] ?? save.ability} {withSign(save.modifier)}
                {save.proficient ? " ●" : ""}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Fertigkeiten</h3>
          <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {sheet.derived.skills.map((skill) => (
              <li key={skill.key} className="flex justify-between gap-2">
                <span>
                  {skill.label}
                  {skill.proficiency === "expertise" ? " ◆" : ""}
                  {skill.proficiency === "proficient" ? " ●" : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {withSign(skill.modifier)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {prepared.length > 0 ? (
          <section>
            <h3 className="mb-1 text-sm font-semibold">Vorbereitete Zauber</h3>
            <ul className="grid gap-1 text-sm">
              {prepared.map((spell) => (
                <li key={spell.id} className="flex justify-between gap-2">
                  <span>{spell.displayName || spell.spellKey}</span>
                  <span className="text-muted-foreground">
                    {spell.spellLevel === 0 ? "Zaubertrick" : `Grad ${spell.spellLevel}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {character.notes.trim() ? (
          <section>
            <h3 className="mb-1 text-sm font-semibold">Notizen am Bogen</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{character.notes}</p>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
