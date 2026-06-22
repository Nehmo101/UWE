import { LoadingPage, LoadingSpinner } from "../Feedback";
import { cn } from "./cn";

export function LoadingState({
  label = "Laden…",
  fullPage = false,
  size = "md",
  className,
}: {
  label?: string;
  fullPage?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (fullPage) {
    return <LoadingPage label={label} />;
  }

  return (
    <div className={cn("uwe-loading-state", className)}>
      <LoadingSpinner label={label} size={size} />
    </div>
  );
}
