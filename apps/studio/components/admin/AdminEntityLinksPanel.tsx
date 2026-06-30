import Link from "next/link";
import {
  listResolvedAdminLinksForEntity,
  prisma,
  type AdminLinkSourceType,
} from "@uwe/database/server";

interface Props {
  sourceType: AdminLinkSourceType;
  sourceId: string;
}

export async function AdminEntityLinksPanel({ sourceType, sourceId }: Props) {
  const links = await listResolvedAdminLinksForEntity(prisma, sourceType, sourceId);

  if (links.length === 0) {
    return null;
  }

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Verknüpfungen</h2>
      <ul className="uwe-today-card-list">
        {links.map((link) => (
          <li key={link.id} className="uwe-today-card">
            <p className="uwe-dashboard-muted">
              {link.relationLabel} · {link.entityType}
            </p>
            {link.href ? (
              <Link href={link.href}>{link.title}</Link>
            ) : (
              <span>{link.title}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
