import Link from "next/link";
import { buttonVariants } from "@/src/components/ui";

export function SettingsStatusTab() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Systemstatus</h2>
      <p className="text-sm text-muted-foreground">
        Vollständige Diagnose für UWE, Datenbank, Storage, Cloudflare, Auth, Mail, Brain,
        RTX-Inference, Embeddings und Jobs — ohne Secrets.
      </p>
      <p className="mt-4 flex flex-wrap gap-2.5">
        <Link className={buttonVariants({ variant: "default" })} href="/system?tab=diagnose">
          System-Diagnose
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/system">
          System-Hub
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/system/rtx-connector">
          RTX Connector
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/ai">
          KI
        </Link>
      </p>
    </section>
  );
}
