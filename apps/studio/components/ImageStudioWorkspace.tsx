"use client";

import { useState, type ReactNode } from "react";
import { Button, Card, ToolWindow } from "@uwe/shared-ui";

interface ImageStudioWorkspaceProps {
  inlineForm: ReactNode;
  disabled?: boolean;
}

/** Opens the image job form in a workspace tool window (desktop) or fullscreen sheet (mobile). */
export function ImageStudioWorkspace({
  inlineForm,
  disabled = false,
}: ImageStudioWorkspaceProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card title="Neues Bild" className="uwe-image-studio-launcher">
        <p className="uwe-dashboard-muted">
          Generierung und Inpainting in einem Arbeitsfenster — ohne die Projektliste zu verlassen.
        </p>
        <div className="uwe-image-studio-launcher-actions">
          <Button
            type="button"
            variant="primary"
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            Generator öffnen
          </Button>
        </div>
      </Card>

      <section className="uwe-v2-card uwe-form uwe-image-studio-inline" aria-label="Neues Bild">
        <h2>Neues Bild</h2>
        {inlineForm}
      </section>

      <ToolWindow
        open={open}
        onClose={() => setOpen(false)}
        title="Image Studio — Neues Bild"
        size="lg"
      >
        {inlineForm}
      </ToolWindow>
    </>
  );
}
