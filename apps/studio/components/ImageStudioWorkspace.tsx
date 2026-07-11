"use client";

import { useState, type ReactNode } from "react";
import { ToolWindow } from "@uwe/shared-ui";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle>Neues Bild</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Generierung und Inpainting in einem Arbeitsfenster — ohne die Projektliste zu verlassen.
          </p>
          <Button
            type="button"
            variant="default"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="self-start"
          >
            Generator öffnen
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:hidden" aria-label="Neues Bild">
        <CardHeader>
          <CardTitle>Neues Bild</CardTitle>
        </CardHeader>
        <CardContent>{inlineForm}</CardContent>
      </Card>

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
