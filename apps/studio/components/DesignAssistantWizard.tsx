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
            "Der Design-Assistent ist nicht erreichbar. Läuft der RTX-Host / ist ein lokales LLM eingerichtet?",
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
    <div className="uwe-design-assistant">
      <p className="uwe-hint">
        Beschreibe dein Wunschdesign — der lokale RTX-Assistent stellt Rückfragen,
        schlägt Farbvarianten vor und speichert das gewählte Design als auswählbares
        Theme. Läuft lokal; es werden keine Kampagnen-Inhalte gesendet.
      </p>

      <label className="uwe-design-assistant-scope">
        Ziel
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          disabled={pending}
        >
          {SCOPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {!empty && (
        <div className="uwe-design-assistant-chat" role="log" aria-live="polite">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`uwe-design-assistant-msg uwe-design-assistant-msg-${m.role}`}
            >
              <span className="uwe-design-assistant-msg-who">
                {m.role === "user" ? "Du" : "Assistent"}
              </span>
              <span className="uwe-design-assistant-msg-body">{m.content}</span>
            </div>
          ))}
          {pending && (
            <div className="uwe-design-assistant-msg uwe-design-assistant-msg-assistant">
              <span className="uwe-design-assistant-msg-who">Assistent</span>
              <span className="uwe-design-assistant-msg-body">…denkt nach</span>
            </div>
          )}
        </div>
      )}

      {palettes.length > 0 && (
        <div className="uwe-design-assistant-palettes">
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
        <div className="uwe-design-assistant-preview-bar">
          <span>Live-Vorschau aktiv.</span>
          <button type="button" className="uwe-btn uwe-btn-ghost" onClick={resetPreview}>
            Vorschau beenden
          </button>
        </div>
      )}

      {error && (
        <p className="uwe-notice" role="status">
          {error}
        </p>
      )}
      {saveNote && (
        <p className="uwe-hint" role="status">
          {saveNote}
        </p>
      )}

      <form
        className="uwe-design-assistant-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) sendMessage(input);
        }}
      >
        <input
          type="text"
          value={input}
          placeholder={
            empty
              ? "z. B. warmes, dunkles Design mit türkisem Akzent"
              : "Antworten oder Wunsch präzisieren…"
          }
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
        />
        <button type="submit" className="uwe-btn uwe-btn-primary" disabled={!canSend}>
          Senden
        </button>
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
    <div className="uwe-card uwe-design-assistant-palette">
      <div className="uwe-design-assistant-swatch" aria-hidden="true">
        {swatches.map((s) => (
          <span key={s.key} title={s.title} style={{ background: s.value }} />
        ))}
      </div>
      <strong className="uwe-design-assistant-palette-label">{palette.label}</strong>
      {palette.description && (
        <span className="uwe-design-assistant-palette-desc">{palette.description}</span>
      )}

      <div className="uwe-design-assistant-status">
        {blocked ? (
          <span className="uwe-badge uwe-badge-danger">{errors} Fehler</span>
        ) : (
          <span className="uwe-badge uwe-badge-success">AA ok</span>
        )}
        {warnings > 0 && (
          <span className="uwe-badge uwe-badge-warning">{warnings} Hinweis(e)</span>
        )}
      </div>

      <input
        type="text"
        aria-label="Design-Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="uwe-design-assistant-name"
      />

      <div className="uwe-design-assistant-actions">
        <button type="button" className="uwe-btn uwe-btn-ghost" onClick={onPreview}>
          Vorschau
        </button>
        {blocked ? (
          <button type="button" className="uwe-btn uwe-btn-ghost" onClick={onImprove}>
            Verbessern
          </button>
        ) : (
          <button
            type="button"
            className="uwe-btn uwe-btn-primary"
            onClick={() => onSave(name)}
            disabled={saving}
          >
            Speichern
          </button>
        )}
      </div>
    </div>
  );
}
