import { useId, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

interface InfoTipProps {
  label: string;
  children: ReactNode;
}

/**
 * Small, keyboard-accessible explanation for settings and operational terms.
 * The tooltip is intentionally CSS-driven so it also works in the Tauri webview.
 */
export function InfoTip({ label, children }: InfoTipProps) {
  const id = useId();

  return (
    <span className="connector-info-tip">
      <button
        type="button"
        className="connector-info-trigger"
        aria-label={label}
        aria-describedby={id}
      >
        <CircleHelp aria-hidden size={15} />
      </button>
      <span className="connector-tooltip" id={id} role="tooltip">
        {children}
      </span>
    </span>
  );
}
