import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle";

export type ButtonSize = "default" | "sm" | "small";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "uwe-btn",
  primary: "uwe-btn uwe-btn-primary",
  secondary: "uwe-btn uwe-btn-secondary",
  ghost: "uwe-btn uwe-btn-ghost",
  danger: "uwe-btn uwe-btn-danger",
  subtle: "uwe-btn uwe-btn-subtle",
};

const SIZE_CLASS: Record<ButtonSize, string | undefined> = {
  default: undefined,
  sm: "uwe-btn-sm",
  small: "uwe-btn-small",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...props}
    />
  );
});
