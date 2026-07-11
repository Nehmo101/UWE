import Link from "next/link";
import { DungeonPrepStatusBadge } from "@uwe/shared-ui";
import type { DungeonPrepStatus, PageType } from "@uwe/database/enums";
import { buildPageUrl } from "@uwe/database/server";
import { pageLabelNewHref } from "@/src/lib/label-links";
import { buttonVariants } from "@/src/components/ui";

interface EntityItem {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  prepStatus: DungeonPrepStatus | null;
}

interface Props {
  title: string;
  worldSlug: string;
  items: EntityItem[];
  /** Secret pages get DM + Player label shortcuts */
  isSecretSection?: boolean;
}

const LABEL_LINK_CLASS = buttonVariants({ variant: "ghost", size: "sm" });

export function DungeonEntityList({
  title,
  worldSlug,
  items,
  isSecretSection = false,
}: Props) {
  if (items.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm italic text-muted-foreground">Keine Einträge.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            <Link href={buildPageUrl(worldSlug, item.type, item.slug)}>
              {item.title}
            </Link>
            <DungeonPrepStatusBadge status={item.prepStatus} />
            <span className="flex flex-wrap items-center gap-2">
              {isSecretSection ? (
                <>
                  <Link
                    className={LABEL_LINK_CLASS}
                    href={pageLabelNewHref(worldSlug, item.type, item.id, {
                      includeDmOnly: true,
                    })}
                  >
                    DM-Label
                  </Link>
                  <Link
                    className={LABEL_LINK_CLASS}
                    href={pageLabelNewHref(worldSlug, item.type, item.id)}
                  >
                    Spieler-Label
                  </Link>
                </>
              ) : (
                <Link
                  className={LABEL_LINK_CLASS}
                  href={pageLabelNewHref(worldSlug, item.type, item.id)}
                >
                  Label
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
