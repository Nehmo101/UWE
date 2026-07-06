import Link from "next/link";

export type AdminFilterChip = {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
  severity?: "info" | "warn" | "error";
};

export function AdminFilterChips({
  chips,
  ariaLabel,
}: {
  chips: AdminFilterChip[];
  ariaLabel: string;
}) {
  return (
    <section className="uwe-today-attention" aria-label={ariaLabel}>
      <div className="uwe-today-quick-chips">
        {chips.map((chip) => (
          <Link
            key={chip.href}
            href={chip.href}
            className="uwe-today-quick-chip"
            data-severity={chip.active ? "warn" : (chip.severity ?? "info")}
            aria-current={chip.active ? "page" : undefined}
          >
            {chip.label}
            {chip.count != null ? ` (${chip.count})` : ""}
          </Link>
        ))}
      </div>
    </section>
  );
}
