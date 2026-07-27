import Link from "next/link";
import {
  HardwareStatusEnum,
  HARDWARE_STATUS_LABELS,
  prisma,
} from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, StudioShell } from "@/src/components/shell";
import { SystemHubBanner } from "@/components/SystemHubBanner";
import { HostUpdatePanel } from "@/components/HostUpdatePanel";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { formatStudioDateTime } from "@/src/lib/format";
import {
  addHardwareErrorAction,
  createHardwareAction,
  deleteHardwareAction,
  recordHardwareCheckAction,
  toggleHardwareSetupStepAction,
  updateHardwareAction,
} from "../life-admin-actions";
import { getHomelabCockpitData } from "@/src/lib/homelab-dashboard";
import { AutoRefreshPanel } from "@/src/components/ux/AutoRefreshPanel";
import {
  Alert,
  Badge,
  type BadgeProps,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

type Severity = "ok" | "warn" | "error";

const STATUS_DOT_CLASS: Record<Severity, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  error: "bg-destructive",
};

const STATUS_BORDER_CLASS: Record<Severity, string> = {
  ok: "border-success/40",
  warn: "border-warning/40",
  error: "border-destructive/40",
};

type HardwareSeverity = "ok" | "warn" | "error" | "neutral";

const HARDWARE_BADGE_VARIANT: Record<HardwareSeverity, BadgeProps["variant"]> = {
  ok: "success",
  warn: "warning",
  error: "danger",
  neutral: "default",
};

const HARDWARE_BADGE_DOT_CLASS: Record<HardwareSeverity, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  error: "bg-destructive",
  neutral: "bg-muted-foreground",
};

function severityStatus(severity: string, ok: boolean): Severity {
  if (severity === "ok" || ok) return "ok";
  if (severity === "warn" || severity === "unknown") return "warn";
  return "error";
}

function hardwareStatusSeverity(status: string): HardwareSeverity {
  if (status === "active") return "ok";
  if (status === "offline" || status === "broken") return "error";
  if (status === "planned") return "warn";
  return "neutral";
}

export default async function HardwarePage() {
  const [cockpit, user] = await Promise.all([
    getHomelabCockpitData(prisma),
    getCurrentAuthUser(),
  ]);
  const canTriggerHostUpdate = user?.isOwner === true;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Hardware / Homelab" }]} />}>
      <PageHeader
        title="Hardware / Homelab"
        summary="Kontrollzentrum für Host, RTX, Cloudflare, Dienste, Runbooks und Security."
      />

      <div className="flex flex-col gap-6">
        <SystemHubBanner />
        <HostUpdatePanel canTrigger={canTriggerHostUpdate} />

        {cockpit.urlWarnings.length > 0 && (
          <Alert
            tone="danger"
            role="alert"
            title="Sicherheitswarnungen (RTX niemals öffentlich):"
          >
            <ul className="mt-1 list-disc pl-5">
              {cockpit.urlWarnings.map((warning) => (
                <li key={`${warning.deviceId}-${warning.field}`}>
                  {warning.deviceName}: {warning.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <AutoRefreshPanel intervalMs={30_000} label="Service-Status wird alle 30 Sekunden aktualisiert.">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Service-Status</h2>
            <p className="text-sm text-muted-foreground">
              Stand: {formatStudioDateTime(cockpit.timestamp)} ·{" "}
              <Link href="/system?tab=diagnose">System-Diagnose →</Link>
            </p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
              {cockpit.serviceStatuses.map((service) => {
                const severity = severityStatus(service.severity, service.ok);
                return (
                  <Card key={service.id} className={cn("p-3", STATUS_BORDER_CLASS[severity])}>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-medium">
                      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[severity])} />
                      {service.label}
                    </h3>
                    <p className="m-0 text-xs text-muted-foreground">{service.message}</p>
                  </Card>
                );
              })}
            </div>
          </section>
        </AutoRefreshPanel>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Security Checklist</h2>
          <ul className="grid gap-2">
            {cockpit.securityChecks.map((check) => {
              const severity = severityStatus(check.severity, check.ok);
              return (
                <li
                  key={check.id}
                  className={cn("rounded-[var(--radius)] border p-3 text-sm", STATUS_BORDER_CLASS[severity])}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[severity])} />
                    <strong>{check.label}</strong>
                    {check.manual ? " (manuell)" : ""}
                  </span>
                  <span className="mt-1 block text-muted-foreground">{check.message}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted-foreground">
            Details: Command Center → Betrieb → Security.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Runbooks</h2>
          <div className="grid gap-2">
            {cockpit.runbooks.map((runbook) => (
              <details
                key={runbook.id}
                className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <summary className="cursor-pointer">
                  <strong>{runbook.title}</strong> — {runbook.summary}
                </summary>
                <ol className="mt-2 list-decimal pl-5 text-sm">
                  {runbook.steps.map((step) => (
                    <li key={`${runbook.id}-${step.order}`}>
                      {step.instruction}
                      {step.command ? (
                        <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">
                          {step.command}
                        </code>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Fehlerhistorie</h2>
          {cockpit.errorHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine dokumentierten Fehler.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {cockpit.errorHistory.slice(0, 20).map((entry) => (
                <Card key={`${entry.deviceId}-${entry.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{entry.problem}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 text-sm">
                    <p className="m-0 text-muted-foreground">
                      {entry.deviceName} · {formatStudioDateTime(entry.occurredAt)}
                    </p>
                    {entry.affectedServices && entry.affectedServices.length > 0 ? (
                      <p className="m-0 text-muted-foreground">
                        Services: {entry.affectedServices.join(", ")}
                      </p>
                    ) : null}
                    {entry.resolution ? <p className="m-0">Lösung: {entry.resolution}</p> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Neues Gerät</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createHardwareAction} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hardware-new-name">Name</Label>
                <Input id="hardware-new-name" name="name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hardware-new-role">Rolle</Label>
                <Input
                  id="hardware-new-role"
                  name="role"
                  placeholder="z. B. UWE Host, RTX-Rechner, Cloudflare"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hardware-new-status">Status</Label>
                <Select name="status" defaultValue="planned">
                  <SelectTrigger id="hardware-new-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(HardwareStatusEnum).map((status) => (
                      <SelectItem key={status} value={status}>
                        {HARDWARE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hardware-new-hostname">Hostname</Label>
                <Input id="hardware-new-hostname" name="hostname" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hardware-new-ip">IP (lokal)</Label>
                <Input id="hardware-new-ip" name="ipAddress" placeholder="192.168.x.x" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hardware-new-local-url">Lokale URL</Label>
                <Input
                  id="hardware-new-local-url"
                  name="localUrl"
                  placeholder="http://192.168.x.x:3000"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="hardware-new-public-url">
                  Öffentliche URL (nur UWE Host — nie RTX/Ollama)
                </Label>
                <Input id="hardware-new-public-url" name="publicUrl" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hardware-new-os">Betriebssystem</Label>
                <Input id="hardware-new-os" name="operatingSystem" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="hardware-new-specs">Specs (eine Zeile pro Eintrag)</Label>
                <Textarea
                  id="hardware-new-specs"
                  name="specs"
                  rows={2}
                  placeholder={"CPU: …\nRAM: 32 GB"}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="hardware-new-services">Dienste (eine Zeile pro Dienst)</Label>
                <Textarea
                  id="hardware-new-services"
                  name="services"
                  rows={2}
                  placeholder={"UWE Studio\nPostgreSQL"}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="hardware-new-setup-steps">
                  Setup-Schritte (eine Zeile pro Schritt)
                </Label>
                <Textarea id="hardware-new-setup-steps" name="setupSteps" rows={3} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="hardware-new-error-notes">Fehlernotizen</Label>
                <Textarea id="hardware-new-error-notes" name="errorNotes" rows={2} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="hardware-new-notes">Notizen</Label>
                <Textarea id="hardware-new-notes" name="notes" rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Gerät anlegen</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Geräte ({cockpit.deviceCards.length})
          </h2>
          {cockpit.deviceCards.length === 0 ? (
            <EmptyState
              title="Noch keine Geräte"
              description="Dokumentiere Homelab- und UWE-Infrastruktur hier."
              action={
                <Link href="/capture" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Capture öffnen
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
              {cockpit.deviceCards.map((device) => {
                const deviceWarnings = cockpit.urlWarnings.filter((w) => w.deviceId === device.id);
                const severity = hardwareStatusSeverity(device.status);
                const statusLabel =
                  HARDWARE_STATUS_LABELS[device.status as keyof typeof HARDWARE_STATUS_LABELS] ??
                  device.status;

                return (
                  <Card key={device.id}>
                    <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                      <div>
                        <CardTitle className="text-base">{device.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{device.role || "—"}</p>
                      </div>
                      <Badge variant={HARDWARE_BADGE_VARIANT[severity]} className="shrink-0 gap-1.5">
                        <span
                          className={cn("size-2 shrink-0 rounded-full", HARDWARE_BADGE_DOT_CLASS[severity])}
                        />
                        {statusLabel}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                        <div>
                          <dt className="text-muted-foreground">Hostname</dt>
                          <dd className="m-0">{device.hostname || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Lokale IP</dt>
                          <dd className="m-0">{device.ipAddress || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">OS</dt>
                          <dd className="m-0">{device.operatingSystem || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Letzte Prüfung</dt>
                          <dd className="m-0">
                            {device.lastCheckedAt ? formatStudioDateTime(device.lastCheckedAt) : "—"}
                          </dd>
                        </div>
                      </dl>

                      {(device.localUrl || device.publicUrl) && (
                        <p className="break-all text-sm">
                          {device.localUrl ? (
                            <>
                              Lokal:{" "}
                              <a href={device.localUrl} target="_blank" rel="noreferrer">
                                {device.localUrl}
                              </a>
                            </>
                          ) : null}
                          {device.publicUrl ? (
                            <>
                              {" "}
                              · Öffentlich:{" "}
                              <a href={device.publicUrl} target="_blank" rel="noreferrer">
                                {device.publicUrl}
                              </a>
                            </>
                          ) : null}
                        </p>
                      )}

                      {device.specsLines.length > 0 && (
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                          {device.specsLines.map((line) => (
                            <li key={`${device.id}-spec-${line}`}>{line}</li>
                          ))}
                        </ul>
                      )}

                      {device.services.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Dienste: {device.services.join(" · ")}
                        </p>
                      )}

                      {deviceWarnings.length > 0 && (
                        <ul role="alert" className="list-disc pl-5 text-sm text-destructive">
                          {deviceWarnings.map((warning) => (
                            <li key={`${warning.field}-${warning.url}`}>{warning.message}</li>
                          ))}
                        </ul>
                      )}

                      {device.setupSteps.length > 0 && (
                        <details open={device.openSetupSteps > 0}>
                          <summary className="cursor-pointer text-sm font-medium">
                            Setup-Schritte
                            {device.openSetupSteps > 0
                              ? ` (${device.openSetupSteps} offen)`
                              : " (alle erledigt)"}
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1">
                            {device.setupSteps.map((step, index) => (
                              <li key={`${device.id}-step-${index}`}>
                                <form action={toggleHardwareSetupStepAction}>
                                  <input type="hidden" name="deviceId" value={device.id} />
                                  <input type="hidden" name="stepIndex" value={index} />
                                  <Button type="submit" variant="ghost" size="sm" className="justify-start">
                                    {step.done ? "☑" : "☐"} {step.label}
                                  </Button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}

                      <form action={recordHardwareCheckAction}>
                        <input type="hidden" name="deviceId" value={device.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Jetzt geprüft
                        </Button>
                      </form>

                      <details>
                        <summary className="cursor-pointer text-sm font-medium">Fehler melden</summary>
                        <form
                          action={addHardwareErrorAction}
                          className="mt-3 flex flex-col gap-3"
                        >
                          <input type="hidden" name="deviceId" value={device.id} />
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-problem`}>Fehler protokollieren</Label>
                            <Input
                              id={`hardware-${device.id}-problem`}
                              name="problem"
                              placeholder="Problem"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-resolution`}>Lösung</Label>
                            <Input
                              id={`hardware-${device.id}-resolution`}
                              name="resolution"
                              placeholder="Optional"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-affected`}>Betroffene Services</Label>
                            <Input
                              id={`hardware-${device.id}-affected`}
                              name="affectedServices"
                              placeholder="rtx_agent, backup"
                            />
                          </div>
                          <div>
                            <Button type="submit" variant="ghost" size="sm">
                              Fehler speichern
                            </Button>
                          </div>
                        </form>
                      </details>

                      <details>
                        <summary className="cursor-pointer text-sm font-medium">Bearbeiten</summary>
                        <form
                          action={updateHardwareAction}
                          className="mt-3 grid gap-3 sm:grid-cols-2"
                        >
                          <input type="hidden" name="id" value={device.id} />
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-name`}>Name</Label>
                            <Input
                              id={`hardware-${device.id}-name`}
                              name="name"
                              defaultValue={device.name}
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-role`}>Rolle</Label>
                            <Input
                              id={`hardware-${device.id}-role`}
                              name="role"
                              defaultValue={device.role}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-status`}>Status</Label>
                            <Select name="status" defaultValue={device.status}>
                              <SelectTrigger id={`hardware-${device.id}-status`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(HardwareStatusEnum).map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {HARDWARE_STATUS_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-hostname`}>Hostname</Label>
                            <Input
                              id={`hardware-${device.id}-hostname`}
                              name="hostname"
                              defaultValue={device.hostname ?? ""}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-ip`}>IP</Label>
                            <Input
                              id={`hardware-${device.id}-ip`}
                              name="ipAddress"
                              defaultValue={device.ipAddress ?? ""}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-local-url`}>Lokale URL</Label>
                            <Input
                              id={`hardware-${device.id}-local-url`}
                              name="localUrl"
                              defaultValue={device.localUrl ?? ""}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-public-url`}>Öffentliche URL</Label>
                            <Input
                              id={`hardware-${device.id}-public-url`}
                              name="publicUrl"
                              defaultValue={device.publicUrl ?? ""}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`hardware-${device.id}-os`}>Betriebssystem</Label>
                            <Input
                              id={`hardware-${device.id}-os`}
                              name="operatingSystem"
                              defaultValue={device.operatingSystem}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor={`hardware-${device.id}-specs`}>Specs</Label>
                            <Textarea
                              id={`hardware-${device.id}-specs`}
                              name="specs"
                              rows={2}
                              defaultValue={device.specsLines.join("\n")}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor={`hardware-${device.id}-services`}>Dienste</Label>
                            <Textarea
                              id={`hardware-${device.id}-services`}
                              name="services"
                              rows={2}
                              defaultValue={device.services.join("\n")}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor={`hardware-${device.id}-error-notes`}>Fehlernotizen</Label>
                            <Textarea
                              id={`hardware-${device.id}-error-notes`}
                              name="errorNotes"
                              rows={2}
                              defaultValue={device.errorNotes ?? ""}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor={`hardware-${device.id}-notes`}>Notizen</Label>
                            <Textarea
                              id={`hardware-${device.id}-notes`}
                              name="notes"
                              rows={2}
                              defaultValue={device.notes}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 sm:col-span-2">
                            <Button type="submit" variant="secondary" size="sm">
                              Speichern
                            </Button>
                          </div>
                        </form>

                        <form action={deleteHardwareAction} className="mt-4">
                          <input type="hidden" name="id" value={device.id} />
                          <Button type="submit" variant="destructive" size="sm">
                            Gerät löschen
                          </Button>
                        </form>
                      </details>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-sm text-muted-foreground">
          <Link href="/today">← Heute</Link>
        </p>
      </div>
    </StudioShell>
  );
}
