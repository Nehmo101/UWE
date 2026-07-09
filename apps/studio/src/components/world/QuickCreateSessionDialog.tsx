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
        <button type="button" className="uwe-v2-btn uwe-v2-btn-primary">
          Schnell anlegen
        </button>
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
          className="uwe-v2-form"
          onSubmit={() => setOpen(false)}
        >
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <label>
            Titel
            <input name="title" required placeholder="Session 3 — Der Turm" autoFocus />
          </label>
          <label>
            Kampagne
            <select name="campaignSlug" defaultValue={defaultCampaignSlug ?? ""}>
              <option value="">Keine Kampagne</option>
              {campaigns.map((campaign) => (
                <option key={campaign.slug} value={campaign.slug}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Datum (optional)
            <input type="date" name="date" />
          </label>
          <div className="uwe-form-actions">
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Session erstellen
            </button>
            <Link
              className="uwe-v2-btn uwe-v2-btn-ghost"
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
