import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, label, hint, error, id, ...props }, ref) {
    const fieldId =
      id ?? (label ? `uwe-textarea-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

    const field = (
      <textarea
        ref={ref}
        id={fieldId}
        className={cn("uwe-textarea", error && "uwe-input-error", className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    );

    if (!label && !hint && !error) return field;

    return (
      <label className="uwe-field" htmlFor={fieldId}>
        {label && <span className="uwe-field-label">{label}</span>}
        {field}
        {hint && !error && <span className="uwe-field-hint">{hint}</span>}
        {error && (
          <span className="uwe-field-error" role="alert">
            {error}
          </span>
        )}
      </label>
    );
  },
);
