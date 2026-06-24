import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../components/cn";

export type CardV2Props = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
};

export function CardV2({
  className,
  title,
  footer,
  padded = true,
  children,
  ...props
}: CardV2Props) {
  return (
    <article
      className={cn("uwe-v2-card", padded && "uwe-v2-card-padded", className)}
      {...props}
    >
      {title && <h3 className="uwe-v2-card-title">{title}</h3>}
      {children}
      {footer && <div className="uwe-v2-card-footer">{footer}</div>}
    </article>
  );
}
