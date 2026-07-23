import Link from "next/link";
import { notFound } from "next/navigation";
import { createMailPortalService } from "@uwe/mail/portal";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  archiveMailAction,
  sendMailAction,
  setMailReadAction,
  setMailStarredAction,
  trashMailAction,
} from "../../brain-actions";

export const dynamic = "force-dynamic";

function addrList(value: unknown): string {
  if (Array.isArray(value)) return value.filter((a) => typeof a === "string").join(", ");
  return typeof value === "string" ? value : "";
}

function formatWhen(value: Date): string {
  return new Date(value).toLocaleString("de-DE", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function replySubject(subject: string): string {
  const s = subject.trim();
  return /^re:/i.test(s) ? s : `Re: ${s || "(kein Betreff)"}`;
}

export default async function BrainMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/mail" title="Mail">
        <BrainDenied />
      </BrainShell>
    );
  }

  const { id } = await params;
  // getMessage marks the message read + mirrors \Seen to the server.
  const message = await createMailPortalService(brainPrisma).getMessage(id, owner.id);
  if (!message) notFound();

  const starred = Boolean((message as { isStarred?: boolean }).isStarred);

  return (
    <BrainShell active="/mail" title={message.subject || "(kein Betreff)"} eyebrow="Nachricht">
      <p className="brain-lede" style={{ marginBottom: "0.5rem" }}>
        <strong>{message.fromAddress}</strong>
        <br />
        an {addrList(message.toAddresses) || "—"} · {formatWhen(message.receivedAt)}
      </p>

      <div className="brain-head-actions" style={{ marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <Link href="/mail" className="brain-btn brain-btn-ghost brain-btn-sm">
          ← Posteingang
        </Link>
        <form action={setMailStarredAction}>
          <input type="hidden" name="id" value={message.id} />
          <input type="hidden" name="starred" value={starred ? "false" : "true"} />
          <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
            {starred ? "★ Markiert" : "☆ Markieren"}
          </button>
        </form>
        <form action={setMailReadAction}>
          <input type="hidden" name="id" value={message.id} />
          <input type="hidden" name="read" value="false" />
          <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
            Als ungelesen
          </button>
        </form>
        <form action={archiveMailAction}>
          <input type="hidden" name="id" value={message.id} />
          <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
            Archivieren
          </button>
        </form>
        <form action={trashMailAction}>
          <input type="hidden" name="id" value={message.id} />
          <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
            Papierkorb
          </button>
        </form>
      </div>

      <div className="brain-card" style={{ marginBottom: "1.5rem" }}>
        {message.bodyText ? (
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, font: "inherit" }}>
            {message.bodyText}
          </pre>
        ) : message.bodyHtml ? (
          // bodyHtml is already sanitized (sanitizeMailHtml) by the service.
          <div dangerouslySetInnerHTML={{ __html: message.bodyHtml }} />
        ) : (
          <p className="brain-muted">(Kein Textinhalt.)</p>
        )}
        {message.attachments && message.attachments.length > 0 ? (
          <p className="brain-muted" style={{ marginTop: "1rem" }}>
            📎 {message.attachments.map((a) => a.filename).join(", ")}
          </p>
        ) : null}
      </div>

      <section className="brain-section">
        <h2>Antworten</h2>
        <form action={sendMailAction} className="brain-form brain-card">
          <input type="hidden" name="accountId" value={message.accountId} />
          <input type="hidden" name="returnTo" value="/mail" />
          <label>
            An
            <input name="to" defaultValue={message.fromAddress} required />
          </label>
          <label>
            Betreff
            <input name="subject" defaultValue={replySubject(message.subject)} />
          </label>
          <label>
            Text
            <textarea name="bodyText" rows={6} placeholder="Deine Antwort …" />
          </label>
          <div>
            <button type="submit" className="brain-btn" disabled={!message.accountId}>
              Antwort senden
            </button>
          </div>
        </form>
      </section>
    </BrainShell>
  );
}
