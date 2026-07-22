import Link from "next/link";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";
import { createPrintProfileAction, deletePrintProfileAction } from "../../workshop-actions";
import { PrintProfileJsonTools } from "../PrintProfileJsonTools";

interface Props {
  searchParams: Promise<{ imported?: string; error?: string }>;
}

export default async function WorkshopPrintProfilesPage({ searchParams }: Props) {
  const { imported, error } = await searchParams;
  const profiles = await createLifeAdminService(brainPrisma, prisma).listWorkshopPrintProfiles({ limit: 200 });

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Werkstatt", href: "/workshop" },
            { label: "3D-Druck-Profile" },
          ]}
        />
      }
    >
      <PageHeader
        title="3D-Druck-Profile"
        summary="Historie erfolgreicher und gescheiterter Druckläufe — wiederverwendbar für ähnliche Teile."
      />

      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          <Link href="/workshop">← Werkstatt</Link>
        </p>

        {imported ? <Alert tone="success">✓ {imported} Profil(e) importiert.</Alert> : null}
        {error === "parse" ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            JSON konnte nicht gelesen werden.
          </p>
        ) : null}
        {error === "empty" ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            Keine JSON-Daten zum Importieren.
          </p>
        ) : null}

        <PrintProfileJsonTools
          profiles={profiles.map((profile) => ({
            name: profile.name,
            printer: profile.printer,
            nozzle: profile.nozzle,
            filament: profile.filament,
            layerHeight: profile.layerHeight,
            supports: profile.supports,
            result: profile.result,
            errors: profile.errors,
            improvements: profile.improvements,
            notes: profile.notes,
          }))}
        />

        <Card>
          <CardHeader>
            <CardTitle>Neues Druckprofil</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPrintProfileAction} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-profile-new-name">Bezeichnung</Label>
                <Input id="print-profile-new-name" name="name" placeholder="z. B. Ruinen-Tile PLA" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-profile-new-printer">Drucker</Label>
                <Input id="print-profile-new-printer" name="printer" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-profile-new-nozzle">Düse</Label>
                <Input id="print-profile-new-nozzle" name="nozzle" placeholder="0.4 mm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-profile-new-filament">Filament</Label>
                <Input id="print-profile-new-filament" name="filament" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-profile-new-layer-height">Layerhöhe</Label>
                <Input id="print-profile-new-layer-height" name="layerHeight" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-profile-new-supports">Support</Label>
                <Input id="print-profile-new-supports" name="supports" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="print-profile-new-result">Ergebnis</Label>
                <Input id="print-profile-new-result" name="result" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="print-profile-new-errors">Fehler</Label>
                <Textarea id="print-profile-new-errors" name="errors" rows={2} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="print-profile-new-improvements">Verbesserung</Label>
                <Textarea id="print-profile-new-improvements" name="improvements" rows={2} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="print-profile-new-notes">Notizen</Label>
                <Textarea id="print-profile-new-notes" name="notes" rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Profil speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Historie ({profiles.length})</h2>
          {profiles.length === 0 ? (
            <EmptyState
              title="Noch keine Druckprofile"
              description="Dokumentiere Drucker, Filament und Einstellungen nach jedem Lauf."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {profiles.map((profile) => (
                <Card key={profile.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{profile.name || "Drucklauf"}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                      {profile.printer} · Düse {profile.nozzle} · {profile.filament} · Layer{" "}
                      {profile.layerHeight}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Support: {profile.supports || "—"} · Ergebnis: {profile.result || "—"}
                    </p>
                    {profile.errors && <p className="text-sm">Fehler: {profile.errors}</p>}
                    {profile.improvements && <p className="text-sm">Verbesserung: {profile.improvements}</p>}
                    {profile.workshopProject && (
                      <p className="text-sm">
                        <Link href={`/workshop/${profile.workshopProject.id}`}>
                          Projekt: {profile.workshopProject.title}
                        </Link>
                      </p>
                    )}
                    <form action={deletePrintProfileAction}>
                      <input type="hidden" name="id" value={profile.id} />
                      <input type="hidden" name="returnTo" value="/workshop/print-profiles" />
                      <Button type="submit" variant="secondary" size="sm">
                        Löschen
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
