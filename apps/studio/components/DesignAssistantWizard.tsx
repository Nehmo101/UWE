"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyColorTokens, type ThemeColorTokens } from "@uwe/shared-ui";
import type {
  GeneratedPalette,
  ThemeChatMessage,
} from "@uwe/ai-brain/theme-generator";
import { runDesignAssistantTurnAction } from "../app/design-assistant-actions";
import { saveCustomThemeAction } from "../app/custom-theme-actions";
import { Alert, Badge, Button, Card, Input, cn } from "@/src/components/ui";

type Scope = "studio" | "portal" | "both";

const SCOPE_OPTIONS: { id: Scope; label: string }[] = [
  { id: "both", label: "Studio & Portal" },
  { id: "studio", label: "Nur Studio" },
  { id: "portal", label: "Nur Portal" },
];

const SWATCH_KEYS: { key: string; title: string }[] = [
  { key: "bg", title: "Hintergrund" },
  { key: "panel", title: "Panel/Sidebar" },
  { key: "fg", title: "Text" },
  { key: "accent", title: "Akzent" },
];

/** Natives Select — kontrolliert (value/onChange); Kit-Select (Radix) ist dafür noch nicht verdrahtet. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "design"
  );
}

function errorCount(p: GeneratedPalette): number {
  return p.validation.issues.filter((i) => i.severity === "error").length;
}
function warnCount(p: GeneratedPalette): number {
  return p.validation.issues.filter((i) => i.severity === "warning").length;
}

export function DesignAssistantWizard() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("both");
  const [messages, setMessages] = useState<ThemeChatMessage[]>([]);
  const [palettes, setPalettes] = useState<GeneratedPalette[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const idCounter = useRef(0);

  const canSend = input.trim().length > 0 && !pending;

  const sendMessage = useCallback(
    (text: string) => {
      const userMessage = text.trim();
      if (!userMessage) return;
      const history = messages;
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setInput("");
      setError(null);
      setSaveNote(null);
      startTransition(async () => {
        try {
          const result = await runDesignAssistantTurnAction({
            history,
            userMessage,
            scope,
            variantCount: 3,
          });
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.assistantMessage || "…" },
          ]);
          setPalettes(result.palettes);
          if (result.parseError && result.palettes.length === 0) {
            setError(null); // prose was shown as the assistant message
          }
        } catch {
          setError(
            "Der Design-Assistent ist nicht erreichbar. Läuft der Maschinenraum-Host / ist ein lokales LLM eingerichtet?",
          );
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "(Fehler bei der Anfrage)" },
          ]);
        }
      });
    },
    [messages, scope],
  );

  const preview = useCallback((palette: GeneratedPalette) => {
    applyColorTokens(palette.colors as unknown as ThemeColorTokens);
    setPreviewing(true);
  }, []);

  const resetPreview = useCallback(() => {
    // Restore the persisted theme by reloading server-synced preferences.
    router.refresh();
    window.location.reload();
  }, [router]);

  const save = useCallback(
    (palette: GeneratedPalette, name: string) => {
      const label = name.trim() || palette.label || "Mein Design";
      idCounter.current += 1;
      const id = `custom-${slugify(label)}-${idCounter.current}${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      setSaveNote(null);
      setError(null);
      startSaving(async () => {
        try {
          await saveCustomThemeAction({
            id,
            label,
            description: palette.description,
            scope,
            colors: palette.colors,
            createdAt: "",
          });
          setSaveNote(
            `„${label}“ gespeichert — erscheint jetzt in der Theme-Auswahl (${
              SCOPE_OPTIONS.find((s) => s.id === scope)?.label
            }).`,
          );
          router.refresh();
        } catch {
          setError("Speichern fehlgeschlagen.");
        }
      });
    },
    [scope, router],
  );

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Beschreibe dein Wunschdesign — der lokale Maschinenraum-Assistent stellt Rückfragen,
        schlägt Farbvarianten vor und speichert das gewählte Design als auswählbares
        Theme. Läuft lokal; es werden keine Kampagnen-Inhalte gesendet.
      </p>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Ziel
        {/* TODO(design-kit): kontrolliertes natives Select (value/onChange) — Kit-Select (Radix) noch nicht dafür verdrahtet. */}
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          disabled={pending}
          className={NATIVE_SELECT_CLASS}
        >
          {SCOPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {!empty && (
        <Card role="log" aria-live="polite" className="flex max-h-72 flex-col gap-2 overflow-y-auto p-3">
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {m.role === "user" ? "Du" : "Assistent"}
              </span>
              <span
                className={cn(
                  "whitespace-pre-wrap rounded-[var(--radius)] border px-2.5 py-1.5 text-sm",
                  m.role === "user" ? "border-primary/30 bg-primary/10" : "border-border bg-card",
                )}
              >
                {m.content}
              </span>
            </div>
          ))}
          {pending && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Assistent</span>
              <span className="whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card px-2.5 py-1.5 text-sm">
                …denkt nach
              </span>
            </div>
          )}
        </Card>
      )}

      {palettes.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {palettes.map((palette, i) => (
            <PaletteCard
              key={i}
              palette={palette}
              onPreview={() => preview(palette)}
              onSave={(name) => save(palette, name)}
              onImprove={() =>
                sendMessage(
                  `Bitte verbessere die Palette „${palette.label}“ und behebe verbleibende Kontrast-/Vollständigkeitsprobleme.`,
                )
              }
              saving={saving}
            />
          ))}
        </div>
      )}

      {previewing && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>Live-Vorschau aktiv.</span>
          <Button type="button" variant="ghost" size="sm" onClick={resetPreview}>
            Vorschau beenden
          </Button>
        </div>
      )}

      {error && (
        <Alert tone="danger" role="status">
          {error}
        </Alert>
      )}
      {saveNote && (
        <Alert tone="success" role="status">
          {saveNote}
        </Alert>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) sendMessage(input);
        }}
      >
        <Input
          type="text"
          value={input}
          placeholder={
            empty
              ? "z. B. warmes, dunkles Design mit türkisem Akzent"
              : "Antworten oder Wunsch präzisieren…"
          }
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          className="flex-1"
        />
        <Button type="submit" disabled={!canSend}>
          Senden
        </Button>
      </form>
    </div>
  );
}

function PaletteCard({
  palette,
  onPreview,
  onSave,
  onImprove,
  saving,
}: {
  palette: GeneratedPalette;
  onPreview: () => void;
  onSave: (name: string) => void;
  onImprove: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(palette.label);
  const errors = errorCount(palette);
  const warnings = warnCount(palette);
  const blocked = errors > 0;
  const swatches = useMemo(
    () => SWATCH_KEYS.map((s) => ({ ...s, value: palette.colors[s.key] ?? "#000" })),
    [palette.colors],
  );

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="grid h-9 grid-cols-4 overflow-hidden rounded-[var(--radius)] border border-border" aria-hidden="true">
        {swatches.map((s) => (
          <span key={s.key} title={s.title} style={{ background: s.value }} />
        ))}
      </div>
      <strong className="font-semibold">{palette.label}</strong>
      {palette.description && (
        <span className="text-xs text-muted-foreground">{palette.description}</span>
      )}

      <div className="flex flex-wrap gap-1.5">
        {blocked ? (
          <Badge variant="danger">{errors} Fehler</Badge>
        ) : (
          <Badge variant="success">AA ok</Badge>
        )}
        {warnings > 0 && <Badge variant="warning">{warnings} Hinweis(e)</Badge>}
      </div>

      <Input
        type="text"
        aria-label="Design-Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onPreview}>
          Vorschau
        </Button>
        {blocked ? (
          <Button type="button" variant="ghost" className="flex-1" onClick={onImprove}>
            Verbessern
          </Button>
        ) : (
          <Button type="button" className="flex-1" onClick={() => onSave(name)} disabled={saving}>
            Speichern
          </Button>
        )}
      </div>
    </Card>
  );
}
