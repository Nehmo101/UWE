import Link from "next/link";
import {
  listResolvedAdminLinksForEntity,
  prisma,
  type AdminLinkSourceType,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface Props {
  sourceType: AdminLinkSourceType;
  sourceId: string;
}

export async function AdminEntityLinksPanel({ sourceType, sourceId }: Props) {
  const links = await listResolvedAdminLinksForEntity(prisma, brainPrisma, sourceType, sourceId);

  if (links.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verknüpfungen</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.id} className="rounded-[var(--radius)] border border-border p-3">
              <p className="text-sm text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
