import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

export interface PortalAuthShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** Centered auth page shell for login, password reset, and share gates. */
export function PortalAuthShell({
  title,
  description,
  children,
  footer,
  wide = false,
}: PortalAuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className={wide ? "w-full max-w-lg" : "w-full max-w-md"}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className={children ? "space-y-4" : undefined}>{children}</CardContent>
        {footer ? (
          <div className="border-t border-border px-6 pb-6 pt-2 text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </Card>
    </main>
  );
}
