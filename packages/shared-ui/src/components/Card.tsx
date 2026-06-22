import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
};

export function Card({
  className,
  title,
  footer,
  padded = true,
  children,
  ...props
}: CardProps) {
  return (
    <article
      className={cn("uwe-card", padded && "uwe-card-padded", className)}
      {...props}
    >
      {title && <h3 className="uwe-card-title">{title}</h3>}
      {children}
      {footer && <div className="uwe-card-footer">{footer}</div>}
    </article>
  );
}
