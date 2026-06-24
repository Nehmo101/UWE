import Link from "next/link";
import { DungeonPrepStatusBadge } from "@uwe/shared-ui";
import type { DungeonPrepStatus, PageType } from "@uwe/database/enums";
import { buildPageUrl } from "@uwe/database/server";
import { pageLabelNewHref } from "@/src/lib/label-links";

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

export function DungeonEntityList({
  title,
  worldSlug,
  items,
  isSecretSection = false,
}: Props) {
  if (items.length === 0) {
    return (
      <section className="uwe-v2-section">
        <h3>{title}</h3>
        <p className="uwe-v2-empty">Keine Einträge.</p>
      </section>
    );
  }

  return (
    <section className="uwe-v2-section">
      <h3>{title}</h3>
      <ul className="uwe-linked-list">
        {items.map((item) => (
          <li key={item.id} className="uwe-linked-list-item-with-actions">
            <Link href={buildPageUrl(worldSlug, item.type, item.slug)}>
              {item.title}
            </Link>
            <DungeonPrepStatusBadge status={item.prepStatus} />
            <span className="uwe-inline-actions">
              {isSecretSection ? (
                <>
                  <Link
                    className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
                    href={pageLabelNewHref(worldSlug, item.type, item.id, {
                      includeDmOnly: true,
                    })}
                  >
                    DM-Label
                  </Link>
                  <Link
                    className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
                    href={pageLabelNewHref(worldSlug, item.type, item.id)}
                  >
                    Spieler-Label
                  </Link>
                </>
              ) : (
                <Link
                  className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
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
