import type { ReactNode } from "react";
import { ErrorAlert } from "../Feedback";
import { cn } from "./cn";

export function ErrorState({
  title = "Fehler",
  message,
  action,
  className,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("uwe-error-state", className)}>
      <ErrorAlert title={title} message={message} action={action} />
    </div>
  );
}
