import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, id, ...props },
  ref,
) {
  const inputId = id ?? (label ? `uwe-input-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

  const field = (
    <input
      ref={ref}
      id={inputId}
      className={cn("uwe-input", error && "uwe-input-error", className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={
        error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
      }
      {...props}
    />
  );

  if (!label && !hint && !error) return field;

  return (
    <label className="uwe-field" htmlFor={inputId}>
      {label && <span className="uwe-field-label">{label}</span>}
      {field}
      {hint && !error && (
        <span className="uwe-field-hint" id={`${inputId}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="uwe-field-error" id={`${inputId}-error`} role="alert">
          {error}
        </span>
      )}
    </label>
  );
});
