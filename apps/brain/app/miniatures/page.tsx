import Link from "next/link";
import {
  createMiniatureCollectionService,
  MINIATURE_COLLECTION_STATUS_LABELS,
  MiniatureCollectionStatusEnum,
  type MiniatureCollectionStatus,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import {
  createMiniatureAction,
  deleteMiniatureAction,
  updateMiniatureAction,
} from "../brain-actions";

/**
 * Miniaturen-Sammlung — Abschnitt H6, Brain gewinnt.
 *
 * Gegenüber der Brain-Fassung neu: die Filter der Studio-Seite (Status,
 * Hersteller, Spielsystem) samt Fortschrittszahlen. Der Fotovergleich bleibt
 * offen — er hängt am Studio-Asset-Upload.
 */

export const dynamic = "force-dynamic";

const STATUSES = Object.values(MiniatureCollectionStatusEnum) as MiniatureCollectionStatus[];
const STATUS = STATUSES.map((value) => ({
  value,
  label: MINIATURE_COLLECTION_STATUS_LABELS[value] ?? value,
}));

const ALL = "all";

interface Props {
  searchParams: Promise<{ status?: string; manufacturer?: string; gameSystem?: string }>;
}

function chipClass(active: boolean): string {
  return active ? "brain-btn brain-btn-sm" : "brain-btn brain-btn-ghost brain-btn-sm";
}

function buildHref(current: Record<string, string | undefined>, patch: Record<string, string | undefined>): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value && value !== ALL) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/miniatures?${query}` : "/miniatures";
}

export default async function BrainMiniaturesPage({ searchParams }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/miniatures" title="Miniaturen">
        <BrainDenied />
      </BrainShell>
    );
  }

  const params = await searchParams;
  const statusFilter = STATUSES.includes(params.status as MiniatureCollectionStatus)
    ? (params.status as MiniatureCollectionStatus)
    : undefined;
  const manufacturerFilter = params.manufacturer?.trim() || undefined;
  const gameSystemFilter = params.gameSystem?.trim() || undefined;

  const service = createMiniatureCollectionService(brainPrisma);
  const [allItems, items] = await Promise.all([
    service.listItems(),
    service.listItems({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(manufacturerFilter ? { manufacturer: manufacturerFilter } : {}),
      ...(gameSystemFilter ? { gameSystem: gameSystemFilter } : {}),
    }),
  ]);

  const filterState = {
    status: statusFilter,
    manufacturer: manufacturerFilter,
    gameSystem: gameSystemFilter,
  };
  const manufacturers = [...new Set(allItems.map((item) => item.manufacturer).filter(Boolean))].sort() as string[];
  const gameSystems = [...new Set(allItems.map((item) => item.gameSystem).filter(Boolean))].sort() as string[];

  return (
    <BrainShell
      active="/miniatures"
      title="Miniaturen-Sammlung"
      lede={`${allItems.length} Eintrag/Einträge — persönliche Hobby-Sammlung. Kaufstatus, Fraktionen, Bemal-Fortschritt.`}
    >
      <div className="brain-kpis">
        {STATUSES.map((status) => (
          <Link
            key={status}
            className="brain-kpi"
            href={buildHref(filterState, { status: statusFilter === status ? ALL : status })}
            aria-current={statusFilter === status ? "page" : undefined}
          >
            <strong>{allItems.filter((item) => item.status === status).length}</strong>
            <span>
              {MINIATURE_COLLECTION_STATUS_LABELS[status] ?? status}
              {statusFilter === status ? " · Filter aktiv" : ""}
            </span>
          </Link>
        ))}
      </div>

      {manufacturers.length > 0 || gameSystems.length > 0 ? (
        <nav className="brain-form-row" aria-label="Sammlung filtern">
          <Link className={chipClass(!manufacturerFilter && !gameSystemFilter)} href={buildHref(filterState, { manufacturer: ALL, gameSystem: ALL })}>
            Alle
          </Link>
          {manufacturers.map((manufacturer) => (
            <Link
              key={`m-${manufacturer}`}
              className={chipClass(manufacturerFilter === manufacturer)}
              href={buildHref(filterState, {
                manufacturer: manufacturerFilter === manufacturer ? ALL : manufacturer,
              })}
            >
              {manufacturer}
            </Link>
          ))}
          {gameSystems.map((gameSystem) => (
            <Link
              key={`g-${gameSystem}`}
              className={chipClass(gameSystemFilter === gameSystem)}
              href={buildHref(filterState, {
                gameSystem: gameSystemFilter === gameSystem ? ALL : gameSystem,
              })}
            >
              {gameSystem}
            </Link>
          ))}
        </nav>
      ) : null}
      <section className="brain-section">
        <h2>Neue Miniatur / Einheit</h2>
        <form action={createMiniatureAction} className="brain-form brain-card">
          <label>
            Name
            <input name="name" required placeholder="z. B. Space Marine Squad" />
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Hersteller
              <input name="manufacturer" placeholder="z. B. Games Workshop" />
            </label>
            <label>
              Spielsystem
              <input name="gameSystem" placeholder="z. B. Warhammer 40k" />
            </label>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr 1fr" }}>
            <label>
              Fraktion
              <input name="faction" placeholder="z. B. Ultramarines" />
            </label>
            <label>
              Anzahl
              <input name="quantity" type="number" min={1} defaultValue={1} />
            </label>
            <label>
              Status
              <select name="status" defaultValue="purchased">
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <button type="submit" className="brain-btn">
              Hinzufügen
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Sammlung · {items.length}</h2>
        {items.length === 0 ? (
          <p className="brain-muted">Keine Miniaturen erfasst.</p>
        ) : (
          <ul className="brain-list">
            {items.map((item) => (
              <li key={item.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{item.name}</strong>
                  <span className="brain-tag">{item.status}</span>
                  <span className="brain-muted">
                    {item.quantity}×{item.gameSystem ? ` · ${item.gameSystem}` : ""}
                    {item.faction ? ` · ${item.faction}` : ""}
                  </span>
                  <form action={deleteMiniatureAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
                <details className="brain-edit">
                  <summary>Bearbeiten</summary>
                  <form action={updateMiniatureAction} className="brain-form">
                    <input type="hidden" name="id" value={item.id} />
                    <label>
                      Name
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
                      <label>
                        Hersteller
                        <input name="manufacturer" defaultValue={item.manufacturer ?? ""} />
                      </label>
                      <label>
                        Spielsystem
                        <input name="gameSystem" defaultValue={item.gameSystem ?? ""} />
                      </label>
                    </div>
                    <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "2fr 1fr 1fr" }}>
                      <label>
                        Fraktion
                        <input name="faction" defaultValue={item.faction ?? ""} />
                      </label>
                      <label>
                        Anzahl
                        <input name="quantity" type="number" min={1} defaultValue={item.quantity} />
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={item.status}>
                          {STATUS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div>
                      <button type="submit" className="brain-btn brain-btn-sm">
                        Speichern
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
