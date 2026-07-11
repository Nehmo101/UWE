"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Button, Input, Label, buttonVariants } from "@/src/components/ui";
import { createGameSessionAction } from "@/app/session-actions";

interface CampaignOption {
  slug: string;
  name: string;
}

interface QuickCreateSessionDialogProps {
  worldSlug: string;
  campaigns: CampaignOption[];
  defaultCampaignSlug?: string;
}

/** TODO(design-kit): natives Select bleibt — Server-Action-Formular (FormData)
    braucht name/defaultValue ohne Client-State, siehe SessionDetailClient.tsx. */
const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Quick-create session modal from the sessions list (#652). */
export function QuickCreateSessionDialog({
  worldSlug,
  campaigns,
  defaultCampaignSlug,
}: QuickCreateSessionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Schnell anlegen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Session</DialogTitle>
          <DialogDescription>
            Titel und optionales Datum — Details kannst du danach auf der Session-Seite ergänzen.
          </DialogDescription>
        </DialogHeader>
        <form
          action={createGameSessionAction}
          className="flex flex-col gap-4"
          onSubmit={() => setOpen(false)}
        >
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-create-session-title">Titel</Label>
            <Input
              id="quick-create-session-title"
              name="title"
              required
              placeholder="Session 3 — Der Turm"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-create-session-campaign">Kampagne</Label>
            <select
              id="quick-create-session-campaign"
              name="campaignSlug"
              defaultValue={defaultCampaignSlug ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">Keine Kampagne</option>
              {campaigns.map((campaign) => (
                <option key={campaign.slug} value={campaign.slug}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-create-session-date">Datum (optional)</Label>
            <Input id="quick-create-session-date" type="date" name="date" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Session erstellen</Button>
            <Link
              className={buttonVariants({ variant: "ghost" })}
              href={`/worlds/${worldSlug}/sessions/new${defaultCampaignSlug ? `?campaign=${defaultCampaignSlug}` : ""}`}
            >
              Vollständiges Formular
            </Link>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
