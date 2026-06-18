import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createMailComposeService,
  createMailRecipientService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import type { MailComposeKind } from "@uwe/mail";
import { MailSendForm } from "@/components/MailSendForm";

const COMPOSE_KINDS = new Set<MailComposeKind>(["session_recap", "handout", "share_link"]);

const KIND_LABELS: Record<MailComposeKind, string> = {
  session_recap: "Session-Recap",
  handout: "Handout",
  share_link: "Player-Preview-Link",
};

interface Props {
  searchParams: Promise<{
    kind?: string;
    worldSlug?: string;
    sourceId?: string;
  }>;
}

export default async function MailComposePage({ searchParams }: Props) {
  const { kind: kindParam, worldSlug, sourceId } = await searchParams;

  if (!worldSlug || !sourceId || !kindParam || !COMPOSE_KINDS.has(kindParam as MailComposeKind)) {
    notFound();
  }

  const kind = kindParam as MailComposeKind;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const compose = createMailComposeService(prisma);
  const recipients = createMailRecipientService(prisma);
  const [draft, playersGroup] = await Promise.all([
    compose.compose(kind, worldSlug, sourceId, process.env.NEXT_PUBLIC_PORTAL_URL),
    recipients.ensurePlayersGroup(worldSlug),
  ]);

  if (!draft) notFound();

  const recipientOptions = playersGroup.recipients.map((recipient) => ({
    email: recipient.email,
    name: recipient.name,
  }));

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Mail vorbereiten" href="/studio" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Mail Center", href: "/mail" },
              { label: world.name, href: `/worlds/${worldSlug}` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title={`Mail vorbereiten: ${KIND_LABELS[kind]}`}
            summary="Entwurf bearbeiten und erst nach explizitem Klick senden. DM-only Inhalte werden nicht automatisch übernommen."
          />

          <p className="uwe-hint">
            Quelle: <code>{draft.sourceType}</code> / <code>{draft.sourceId}</code>
          </p>

          <MailSendForm
            worldId={draft.worldId}
            initialSubject={draft.subject}
            initialBodyText={draft.bodyText}
            initialBodyHtml={draft.bodyHtml}
            sourceType={draft.sourceType}
            sourceId={draft.sourceId}
            recipients={recipientOptions}
            warnings={draft.warnings}
            containsDmOnlyHint={draft.containsDmOnlyHint}
          />

          <p className="uwe-hint" style={{ marginTop: "1rem" }}>
            <Link href="/mail">Zurück zum Mail Center</Link>
          </p>
        </>
      }
    />
  );
}
