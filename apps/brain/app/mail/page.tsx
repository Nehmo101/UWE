import { createMailAccountService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

export default async function BrainMailPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/mail" title="Mail">
        <BrainDenied />
      </BrainShell>
    );
  }

  const service = createMailAccountService(brainPrisma);
  const [accounts, inbox] = await Promise.all([service.listAccounts(), service.listInbox(undefined, 50)]);

  return (
    <BrainShell active="/mail" title="Mail-Center">
      <p>
        {accounts.length} Konto/Konten · {inbox.length} Nachricht(en) — persönliche Kommunikation,
        lokal auf deiner Hardware.
      </p>
      {inbox.length === 0 ? (
        <p>Keine Nachrichten.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {inbox.map((message) => (
            <li key={message.id} className="brain-row">
              <strong>{message.subject || "(kein Betreff)"}</strong>
              <span className="brain-muted"> · {message.fromAddress}</span>
              {message.snippet ? (
                <p style={{ margin: "0.35rem 0 0" }} className="brain-muted">
                  {message.snippet}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </BrainShell>
  );
}
