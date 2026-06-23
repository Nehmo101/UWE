export type CockpitStatusLevel = "ok" | "warn" | "error" | "off";

export interface CockpitStatusItem {
  id: string;
  label: string;
  value: string;
  level: CockpitStatusLevel;
}

export interface StudioStatusFooterProps {
  items: CockpitStatusItem[];
}

/** Compact AI/system status strip for the Studio cockpit shell footer. */
export function StudioStatusFooter({ items }: StudioStatusFooterProps) {
  if (items.length === 0) return null;

  return (
    <footer className="uwe-status-footer" aria-label="Systemstatus">
      <ul className="uwe-status-footer-list">
        {items.map((item) => (
          <li key={item.id} className="uwe-status-footer-item" data-level={item.level}>
            <span className="uwe-status-footer-dot" aria-hidden />
            <span className="uwe-status-footer-label">{item.label}</span>
            <span className="uwe-status-footer-value">{item.value}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
