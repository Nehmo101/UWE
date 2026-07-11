import { notFound } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import {
  buildOneShotOutline,
  ONE_SHOT_TONE_LABELS,
  ONE_SHOT_TONES,
  serializeOneShotOutline,
  type OneShotTone,
} from "@uwe/ai-brain";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { saveOneShotDraftAction } from "@/app/worlds/[worldSlug]/one-shot-actions";
import { getInferenceStatus } from "@uwe/ai-brain";
import { OneShotQuickAssistant } from "@/components/OneShotQuickAssistant";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ location?: string; tone?: string; npc?: string | string[] }>;
}

function isTone(value: string | undefined): value is OneShotTone {
  return !!value && (ONE_SHOT_TONES as string[]).includes(value);
}

const NATIVE_SELECT_CLASS =
  "flex h-9 w-full min-w-40 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function OneShotPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { location, tone, npc } = await searchParams;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const pages = await prisma.page.findMany({
    where: { worldId: world.id, type: { in: ["location", "region", "npc"] } },
    select: { title: true, type: true },
    orderBy: { title: "asc" },
  });
  const locations = pages.filter((p) => p.type === "location" || p.type === "region");
  const npcs = pages.filter((p) => p.type === "npc");
  const selectedNpcs = (Array.isArray(npc) ? npc : npc ? [npc] : []).filter(Boolean);

  const generate = !!location && isTone(tone);
  const outline = generate
    ? buildOneShotOutline({
        worldName: world.name,
        worldSlug,
        locationName: location!,
        tone: tone as OneShotTone,
        npcs: selectedNpcs.map((name) => ({ name })),
      })
    : null;
  const inference = await getInferenceStatus();

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "One-Shot-Generator", `/worlds/${worldSlug}/one-shot`)}
        />
      }
    >
      <PageHeader
        title="One-Shot-Generator aus Kanon"
        summary="Ort, Ton und bekannte NPCs wählen — UWE baut ein kanon-safes One-Shot-Gerüst mit getrenntem Spieler-Brief und DM-Geheimnissen. Als Quest-Entwurf speicherbar; nichts wird automatisch Kanon."
      />

      <OneShotQuickAssistant
        worldSlug={worldSlug}
        locations={locations}
        rtxReady={inference.online}
        rtxEnabled={inference.enabled}
      />

      <Card>
        <CardHeader>
          <CardTitle>Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="one-shot-location">Ort</Label>
                {/* TODO(design-kit): natives Select statt Kit-Select — "— wählen —"
                    braucht einen Leerwert, den Radix Select nicht unterstützt. */}
                <select
                  id="one-shot-location"
                  name="location"
                  defaultValue={location ?? ""}
                  className={NATIVE_SELECT_CLASS}
                >
                  <option value="">— wählen —</option>
                  {locations.map((loc) => (
                    <option key={loc.title} value={loc.title}>
                      {loc.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="one-shot-tone">Ton</Label>
                <Select name="tone" defaultValue={tone ?? "mystery"}>
                  <SelectTrigger id="one-shot-tone" className="min-w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ONE_SHOT_TONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ONE_SHOT_TONE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Generieren</Button>
            </div>
            {npcs.length > 0 ? (
              <fieldset className="border-0 p-0">
                <legend className="text-sm font-medium text-foreground">NPCs einbeziehen</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {npcs.slice(0, 16).map((n) => (
                    <label key={n.title} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      <input type="checkbox" name="npc" value={n.title} defaultChecked={selectedNpcs.includes(n.title)} />
                      {n.title}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {outline ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{outline.title}</CardTitle>
              <CardDescription>
                {ONE_SHOT_TONE_LABELS[outline.tone]} — {outline.atmosphere}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Spieler-Brief</h3>
                <p className="text-sm text-muted-foreground">{outline.playerBrief}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Szenen</h3>
                <ol className="list-decimal pl-5 text-sm text-muted-foreground">
                  {outline.scenes.map((scene, index) => (
                    <li key={index}>{scene}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">DM-Geheimnisse</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {outline.dmSecrets.map((secret, index) => (
                    <li key={index}>{secret}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Kanon-Warnungen</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {outline.canonWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Markdown</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-[var(--radius)] bg-muted p-3 text-sm">
                {serializeOneShotOutline(outline)}
              </pre>
            </CardContent>
          </Card>

          <form action={saveOneShotDraftAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="worldId" value={world.id} />
            <input type="hidden" name="worldName" value={world.name} />
            <input type="hidden" name="location" value={location} />
            <input type="hidden" name="tone" value={tone} />
            {selectedNpcs.map((name) => (
              <input key={name} type="hidden" name="npc" value={name} />
            ))}
            <Button type="submit">Als Quest-Entwurf speichern (Draft)</Button>
          </form>
        </>
      ) : null}
    </WorldShell>
  );
}
