"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { StudioAuthShell } from "@/src/components/StudioAuthShell";
import { Alert, LoadingState } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import type {
  FirstRunPrerequisites,
  FirstRunProductionHints,
  FirstRunCheckStatus,
  FirstRunPrerequisiteItem,
  FirstRunProductionHint,
} from "@uwe/database/first-run-setup-types";

const WIZARD_STEPS = [
  { id: "prerequisites", title: "Voraussetzungen" },
  { id: "owner", title: "Owner anlegen" },
  { id: "production", title: "Produktion" },
  { id: "next", title: "Nächste Schritte" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

interface SetupApiPayload {
  setupAvailable?: boolean;
  setupConfigured?: boolean;
  prerequisites?: FirstRunPrerequisites;
  productionHints?: FirstRunProductionHints;
}

function statusGlyph(status: FirstRunCheckStatus): string {
  if (status === "ok") return "✓";
  if (status === "warning") return "!";
  return "✕";
}

function statusClass(status: FirstRunCheckStatus): string {
  if (status === "ok") return "text-emerald-600 dark:text-emerald-400";
  if (status === "warning") return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function SetupWizardProgress({
  currentStep,
  completedThrough,
}: {
  currentStep: number;
  completedThrough: number;
}) {
  return (
    <nav aria-label="Setup-Fortschritt" className="mb-6">
      <ol className="grid grid-cols-4 gap-2">
        {WIZARD_STEPS.map((step, index) => {
          const isCurrent = index === currentStep;
          const isComplete = index < completedThrough;
          return (
            <li key={step.id} className="flex flex-col items-center gap-1 text-center">
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isComplete
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border bg-muted text-muted-foreground",
                ].join(" ")}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              <span
                className={[
                  "text-[11px] leading-tight",
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PrerequisiteList({ items }: { items: FirstRunPrerequisiteItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-[var(--radius)] border border-border bg-muted/30 p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <span className={`font-semibold ${statusClass(item.status)}`} aria-hidden="true">
              {statusGlyph(item.status)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <code>{item.label}</code>
              </p>
              <p className="text-muted-foreground">{item.message}</p>
              {item.hint ? <p className="mt-1 text-muted-foreground">{item.hint}</p> : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProductionHintList({ items }: { items: FirstRunProductionHint[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-[var(--radius)] border border-border bg-muted/30 p-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <span className={`font-semibold ${statusClass(item.status)}`} aria-hidden="true">
              {statusGlyph(item.status)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground">{item.description}</p>
              {item.envKey ? (
                <p className="mt-1 text-muted-foreground">
                  Env: <code>{item.envKey}</code>
                </p>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OwnerSetupForm({
  setupConfigured,
  onCompleted,
}: {
  setupConfigured: boolean;
  onCompleted: () => void;
}) {
  const [setupToken, setSetupToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(studioApiUrl("/api/auth/setup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupToken, displayName, email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Setup fehlgeschlagen.");
      return;
    }

    onCompleted();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="setupToken">Setup-Token</Label>
        <Input
          id="setupToken"
          name="setupToken"
          type="password"
          autoComplete="off"
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          required
          disabled={!setupConfigured}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Anzeigename</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          disabled={!setupConfigured}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={!setupConfigured}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Passwort (min. 8 Zeichen)</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
          disabled={!setupConfigured}
        />
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Button type="submit" disabled={loading || !setupConfigured}>
        {loading ? "Owner anlegen…" : "Owner anlegen"}
      </Button>
    </form>
  );
}

function stepDescription(stepId: WizardStepId): string {
  switch (stepId) {
    case "prerequisites":
      return "Prüfe Secrets und Datenbank-Migrationen, bevor du den ersten Owner anlegst.";
    case "owner":
      return "Lege den ersten Owner an. Dieser Schritt ist nur einmal möglich und erfordert das Setup-Token aus UWE_SETUP_TOKEN.";
    case "production":
      return "Empfohlene Produktions-Einstellungen für Self-Hosting und öffentliche Deployments.";
    case "next":
      return "Owner ist angelegt. Nutze die folgenden Bereiche für laufende Einrichtung und Betrieb.";
    default:
      return "";
  }
}

export function SetupWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [setupAvailable, setSetupAvailable] = useState<boolean | null>(null);
  const [setupConfigured, setSetupConfigured] = useState(true);
  const [prerequisites, setPrerequisites] = useState<FirstRunPrerequisites | null>(null);
  const [productionHints, setProductionHints] = useState<FirstRunProductionHints | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [ownerCreated, setOwnerCreated] = useState(false);

  useEffect(() => {
    void fetch(studioApiUrl("/api/auth/setup"))
      .then((response) => response.json())
      .then((payload: SetupApiPayload) => {
        setSetupAvailable(Boolean(payload.setupAvailable));
        setSetupConfigured(payload.setupConfigured !== false);
        setPrerequisites(payload.prerequisites ?? null);
        setProductionHints(payload.productionHints ?? null);
      })
      .catch(() => setSetupAvailable(false))
      .finally(() => setLoading(false));
  }, []);

  const currentStep = WIZARD_STEPS[stepIndex];
  const completedThrough = useMemo(() => {
    if (ownerCreated) return WIZARD_STEPS.length;
    if (stepIndex > 0) return stepIndex;
    return prerequisites?.canProceed ? 1 : 0;
  }, [ownerCreated, prerequisites?.canProceed, stepIndex]);

  if (loading || setupAvailable === null) {
    return <LoadingState title="Setup wird geprüft…" />;
  }

  if (!setupAvailable) {
    return (
      <StudioAuthShell
        title="Setup abgeschlossen"
        description="Ein Owner-Konto existiert bereits. Das einmalige Setup ist deaktiviert."
        footer={
          <>
            <Link href="/login" className="text-primary hover:underline">
              Zur Anmeldung
            </Link>
            {" · "}
            <Link href="/admin/setup" className="text-primary hover:underline">
              Owner-Einrichtung (nach Login)
            </Link>
            {" · "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Passwort vergessen?
            </Link>
          </>
        }
      />
    );
  }

  return (
    <StudioAuthShell
      title="UWE Studio — Ersteinrichtung"
      description={stepDescription(currentStep.id)}
      wide
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Bereits ein Konto? Anmelden
        </Link>
      }
    >
      <SetupWizardProgress currentStep={stepIndex} completedThrough={completedThrough} />

      {currentStep.id === "prerequisites" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Erst-Setup unter <strong>/setup</strong> · laufende Host-Konfiguration später unter{" "}
            <Link href="/admin/setup" className="text-primary hover:underline">
              /admin/setup
            </Link>
            .
          </p>
          {prerequisites ? <PrerequisiteList items={prerequisites.items} /> : null}
          {!setupConfigured ? (
            <Alert tone="danger">
              <code>UWE_SETUP_TOKEN</code> ist nicht gesetzt. Generiere ein Token (z. B.{" "}
              <code>openssl rand -hex 32</code>), trage es in <code>.env</code> ein und starte den
              Server neu.
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setStepIndex(1)}
              disabled={!prerequisites?.canProceed || !setupConfigured}
            >
              Weiter
            </Button>
          </div>
        </div>
      ) : null}

      {currentStep.id === "owner" ? (
        <div className="space-y-4">
          <OwnerSetupForm
            setupConfigured={setupConfigured}
            onCompleted={() => {
              setOwnerCreated(true);
              setStepIndex(2);
            }}
          />
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStepIndex(0)}>
              Zurück
            </Button>
          </div>
        </div>
      ) : null}

      {currentStep.id === "production" ? (
        <div className="space-y-4">
          {productionHints ? <ProductionHintList items={productionHints.items} /> : null}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" disabled={ownerCreated} onClick={() => setStepIndex(1)}>
              Zurück
            </Button>
            <Button type="button" onClick={() => setStepIndex(3)}>
              Weiter
            </Button>
          </div>
        </div>
      ) : null}

      {currentStep.id === "next" ? (
        <div className="space-y-4">
          <ul className="space-y-3 text-sm">
            <li className="rounded-[var(--radius)] border border-border p-3">
              <p className="font-medium">Einrichtung (Admin)</p>
              <p className="text-muted-foreground">
                Host-Pfade, Mail, RTX, Cloudflare und Diagnose — laufende Betriebs-Konfiguration.
              </p>
              <Link href="/admin/setup" className="mt-2 inline-block text-primary hover:underline">
                /admin/setup öffnen
              </Link>
            </li>
            <li className="rounded-[var(--radius)] border border-border p-3">
              <p className="font-medium">Startklar nach Updates</p>
              <p className="text-muted-foreground">
                Env-Änderungen, Migrationen und Release-Hinweise nach einem Update.
              </p>
              <Link
                href="/system/startklar"
                className="mt-2 inline-block text-primary hover:underline"
              >
                /system/startklar öffnen
              </Link>
            </li>
            <li className="rounded-[var(--radius)] border border-border p-3">
              <p className="font-medium">Einstellungen</p>
              <p className="text-muted-foreground">
                Welten, Theme, Mail und erweiterte App-Optionen.
              </p>
              <Link href="/settings" className="mt-2 inline-block text-primary hover:underline">
                /settings öffnen
              </Link>
            </li>
          </ul>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStepIndex(2)}>
              Zurück
            </Button>
            <Button
              type="button"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              Zum Studio
            </Button>
          </div>
        </div>
      ) : null}
    </StudioAuthShell>
  );
}
