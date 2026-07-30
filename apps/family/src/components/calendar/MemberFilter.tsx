import Link from "next/link";
import { MemberDot } from "../members/MemberFields";

/**
 * Filterleiste über dem Monatsraster: „nur Anna", „nur Mimi", „alle".
 *
 * Als Links statt als Formular — der Filter gehört in die URL, damit ein
 * gefilterter Monat teilbar und über Vor-/Zurück erreichbar bleibt. Kein
 * Client-JS nötig.
 */

export interface FilterMember {
  id: string;
  displayName: string;
  colour: string;
}

function href(base: { year: number; month: number }, memberId?: string): string {
  const params = new URLSearchParams({
    year: String(base.year),
    month: String(base.month),
  });
  if (memberId) params.set("member", memberId);
  return `/calendar?${params.toString()}`;
}

export function MemberFilter({
  members,
  activeMemberId,
  year,
  month,
}: {
  members: readonly FilterMember[];
  activeMemberId?: string;
  year: number;
  month: number;
}) {
  if (members.length === 0) return null;

  return (
    <nav className="family-filter" aria-label="Nach Person filtern">
      <Link
        href={href({ year, month })}
        className="family-filter-chip"
        aria-current={activeMemberId ? undefined : "true"}
      >
        Alle
      </Link>
      {members.map((member) => (
        <Link
          key={member.id}
          href={href({ year, month }, member.id)}
          className="family-filter-chip"
          aria-current={activeMemberId === member.id ? "true" : undefined}
        >
          <MemberDot colour={member.colour} />
          {member.displayName}
        </Link>
      ))}
    </nav>
  );
}
