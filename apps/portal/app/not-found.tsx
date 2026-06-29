import Link from "next/link";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { EmptyState } from "@/src/components/ui/states";

export default function PortalNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <EmptyState
        title="Seite nicht gefunden"
        description="Diesen Inhalt gibt es nicht — oder er ist für dich (noch) nicht freigeschaltet."
        action={
          <Link href="/" className={cn(buttonVariants())}>
            Zur Portal-Startseite
          </Link>
        }
      />
    </div>
  );
}
