"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Label, Textarea } from "@/src/components/ui";
import { activateAiGeneralPromptAction } from "../ai-prompt-actions";

// TODO(design-kit): Storage-Key ist kein CSS-Klassenname, sondern der bestehende localStorage-Key —
// bewusst unverändert gelassen, um vorhandene Nutzer-Entwürfe nicht zu verlieren (false positive für "uwe-").
const DRAFT_STORAGE_KEY = "uwe-ai-general-chat-prompt-draft";

interface Props {
  activePrompt: string;
  activated?: boolean;
  legacyAiHref: string;
}

export function AiPromptEditorClient({ activePrompt, activated, legacyAiHref }: Props) {
  const [draft, setDraft] = useState(activePrompt);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored != null) setDraft(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, draft);
    } catch {
      // ignore
    }
  }, [draft]);

  const hasUnsavedDraft = draft.trim() !== activePrompt.trim();

  return (
    <div className="flex flex-col gap-6">
      {activated ? <Alert tone="success" icon="check">System-Prompt aktiviert.</Alert> : null}

      <p className="text-sm text-muted-foreground">
        Entwurf wird lokal zwischengespeichert. Erst <strong>Als aktiv setzen</strong> übernimmt den
        Prompt für den allgemeinen KI-Chat.{" "}
        <Link href={legacyAiHref}>KI-Chat testen →</Link>
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Aktiver System-Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="min-h-16 whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-muted p-3 font-mono text-sm">
            {activePrompt.trim() || "— Standard-Prompt (eingebaut) —"}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entwurf bearbeiten</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-prompt-draft-textarea">System-Prompt (general chat)</Label>
            <Textarea
              id="ai-prompt-draft-textarea"
              rows={12}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Anweisungen für den allgemeinen KI-Chat…"
              className="font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setDraft(activePrompt)}>
              Entwurf zurücksetzen
            </Button>
            <form action={activateAiGeneralPromptAction}>
              <input type="hidden" name="prompt" value={draft} />
              <Button type="submit" disabled={!hasUnsavedDraft && !draft.trim()}>
                Als aktiv setzen
              </Button>
            </form>
          </div>
          {hasUnsavedDraft ? (
            <Alert tone="warning">Entwurf weicht vom aktiven Prompt ab — noch nicht live.</Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
