import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../components/cn";

export type ButtonV2Variant =
  | "default"
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "danger";

export type ButtonV2Size = "default" | "sm";

const VARIANT_CLASS: Record<ButtonV2Variant, string> = {
  default: "uwe-v2-btn",
  primary: "uwe-v2-btn uwe-v2-btn-primary",
  accent: "uwe-v2-btn uwe-v2-btn-accent",
  secondary: "uwe-v2-btn uwe-v2-btn-secondary",
  ghost: "uwe-v2-btn uwe-v2-btn-ghost",
  danger: "uwe-v2-btn uwe-v2-btn-danger",
};

const SIZE_CLASS: Record<ButtonV2Size, string | undefined> = {
  default: undefined,
  sm: "uwe-v2-btn-sm",
};

export type ButtonV2Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonV2Variant;
  size?: ButtonV2Size;
};

export const ButtonV2 = forwardRef<HTMLButtonElement, ButtonV2Props>(function ButtonV2(
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
