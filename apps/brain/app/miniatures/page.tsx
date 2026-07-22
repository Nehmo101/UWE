import { createMiniatureCollectionService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

export default async function BrainMiniaturesPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/miniatures" title="Miniaturen">
        <BrainDenied />
      </BrainShell>
    );
  }

  const items = await createMiniatureCollectionService(brainPrisma).listItems();

  return (
    <BrainShell active="/miniatures" title="Miniaturen-Sammlung">
      <p>{items.length} Eintrag/Einträge — persönliche Hobby-Sammlung, lokal.</p>
      {items.length === 0 ? (
        <p>Keine Miniaturen erfasst.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {items.map((item) => (
            <li key={item.id} className="brain-row">
              <strong>{item.name}</strong>
              <span className="brain-tag">{item.status}</span>
              <span className="brain-muted">
                {" "}· {item.quantity}×
                {item.gameSystem ? ` · ${item.gameSystem}` : ""}
                {item.faction ? ` · ${item.faction}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BrainShell>
  );
}
