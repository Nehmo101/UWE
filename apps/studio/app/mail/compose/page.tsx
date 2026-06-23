import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createMailComposeService,
  createMailRecipientService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import type { MailComposeKind } from "@uwe/mail";
import { MailSendForm } from "@/components/MailSendForm";
import { AdminModuleShell } from "@/components/AdminModuleShell";

const COMPOSE_KINDS = new Set<MailComposeKind>([
  "session_recap",
  "session_reminder",
  "handout",
  "share_link",
  "contract_reminder",
  "backup_warning",
  "system_warning",
  "terrain_rental",
]);

const KIND_LABELS: Record<MailComposeKind, string> = {
  session_recap: "Session-Recap",
  session_reminder: "Session-Erinnerung",
  handout: "Handout",
  share_link: "Player-Preview-Link",
  contract_reminder: "Vertragserinnerung",
  backup_warning: "Backup-Warnung",
  system_warning: "Systemwarnung",
  terrain_rental: "Terrain-Verleih",
};

const WORLD_REQUIRED_KINDS = new Set<MailComposeKind>([
  "session_recap",
  "session_reminder",
  "handout",
  "share_link",
]);

interface Props {
  searchParams: Promise<{
    kind?: string;
    worldSlug?: string;
    sourceId?: string;
    title?: string;
    message?: string;
  }>;
}

export default async function MailComposePage({ searchParams }: Props) {
  const { kind: kindParam, worldSlug, sourceId, title, message } = await searchParams;

  if (!kindParam || !COMPOSE_KINDS.has(kindParam as MailComposeKind)) {
    notFound();
  }

  const kind = kindParam as MailComposeKind;

  if (WORLD_REQUIRED_KINDS.has(kind) && (!worldSlug || !sourceId)) {
    notFound();
  }

  if (
    (kind === "contract_reminder" || kind === "terrain_rental") &&
    !sourceId
  ) {
    notFound();
  }

  const compose = createMailComposeService(prisma);
  const draft = await compose.compose(kind, {
    worldSlug,
    sourceId,
    portalBaseUrl: process.env.NEXT_PUBLIC_PORTAL_URL,
    title,
    message,
  });

  if (!draft) notFound();

  let recipientOptions: Array<{ email: string; name: string }> = [];

  if (worldSlug) {
    const recipients = createMailRecipientService(prisma);
    const playersGroup = await recipients.ensurePlayersGroup(worldSlug);
    recipientOptions = playersGroup.recipients.map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
    }));
  }

  const world = worldSlug ? await getAppRepository().getWorldBySlug(worldSlug) : null;

  return (
    <AdminModuleShell
      activePath="/mail"
      backHref="/mail"
      backLabel="Mail Center"
      title={`Mail vorbereiten: ${KIND_LABELS[kind]}`}
      summary="Vorschau prüfen, Empfänger wählen und erst nach explizitem Klick senden. Keine automatischen Mails."
    >
      <p className="uwe-hint">
        Quelle: <code>{draft.sourceType}</code> / <code>{draft.sourceId}</code>
        {world ? (
          <>
            {" "}
            · Welt: <Link href={`/worlds/${worldSlug}`}>{world.name}</Link>
          </>
        ) : null}
      </p>

      <MailSendForm
        worldId={draft.worldId || undefined}
        initialSubject={draft.subject}
        initialBodyText={draft.bodyText}
        initialBodyHtml={draft.bodyHtml}
        sourceType={draft.sourceType}
        sourceId={draft.sourceId}
        recipients={recipientOptions}
        warnings={draft.warnings}
        containsDmOnlyHint={draft.containsDmOnlyHint}
      />
    </AdminModuleShell>
  );
}
