import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, hint, id, children, ...props },
  ref,
) {
  const fieldId = id ?? (label ? `uwe-select-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

  const field = (
    <select ref={ref} id={fieldId} className={cn("uwe-select", className)} {...props}>
      {children}
    </select>
  );

  if (!label && !hint) return field;

  return (
    <label className="uwe-field" htmlFor={fieldId}>
      {label && <span className="uwe-field-label">{label}</span>}
      {field}
      {hint && <span className="uwe-field-hint">{hint}</span>}
    </label>
  );
});
