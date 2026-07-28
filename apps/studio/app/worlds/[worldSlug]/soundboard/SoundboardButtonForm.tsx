"use client";

import { useMemo, useState } from "react";
import {
  validateSoundboardButton,
  type SoundSourceType,
  type SoundboardValidationError,
} from "@uwe/soundboard";
import { Button, Input, Label } from "@/src/components/ui";

/** TODO(design-kit): natives select bleibt — unkontrolliertes/gemischtes Formular
    (Server-Action + lokaler sourceType-State), Kit-Select (Radix) unterstützt zudem
    kein natives multiple-Select für die Seitenverknüpfung. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
// Multi-Select (size-Attribut) braucht Auto-Höhe statt der fixen h-9 aus NATIVE_SELECT_CLASS.
const NATIVE_MULTI_SELECT_CLASS =
  "w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface SoundboardButtonFormValues {
  title: string;
  sourceType: SoundSourceType;
  sourceUrl: string;
  assetId: string;
  thumbnail: string;
  volume: number;
  loop: boolean;
  tags: string;
  linkedPageIds: string[];
}

interface AudioAssetOption {
  id: string;
  title: string;
}

interface PageOption {
  id: string;
  title: string;
  type: string;
}

interface Props {
  action: (formData: FormData) => void | Promise<void>;
  worldSlug: string;
  campaignSlug?: string;
  buttonId?: string;
  initialValues?: Partial<SoundboardButtonFormValues>;
  audioAssets: AudioAssetOption[];
  linkablePages: PageOption[];
  submitLabel: string;
  extraLinkedPages?: PageOption[];
}

function fieldError(
  errors: SoundboardValidationError[],
  field: SoundboardValidationError["field"],
): string | null {
  return errors.find((error) => error.field === field)?.message ?? null;
}

function readFormValues(form: HTMLFormElement): SoundboardButtonFormValues {
  const formData = new FormData(form);
  return {
    title: String(formData.get("title") ?? ""),
    sourceType: String(formData.get("sourceType") ?? "local") as SoundSourceType,
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    assetId: String(formData.get("assetId") ?? ""),
    thumbnail: String(formData.get("thumbnail") ?? ""),
    volume: Number(formData.get("volume") ?? 1),
    loop: formData.get("loop") === "on",
    tags: String(formData.get("tags") ?? ""),
    linkedPageIds: formData.getAll("linkedPageIds").map((value) => String(value)),
  };
}

export function SoundboardButtonForm({
  action,
  worldSlug,
  campaignSlug,
  buttonId,
  initialValues,
  audioAssets,
  linkablePages,
  submitLabel,
  extraLinkedPages = [],
}: Props) {
  const defaults = useMemo(
    () => ({
      title: initialValues?.title ?? "",
      sourceType: initialValues?.sourceType ?? "local",
      sourceUrl: initialValues?.sourceUrl ?? "",
      assetId: initialValues?.assetId ?? "",
      thumbnail: initialValues?.thumbnail ?? "",
      volume: initialValues?.volume ?? 1,
      loop: initialValues?.loop ?? false,
      tags: initialValues?.tags ?? "",
      linkedPageIds: initialValues?.linkedPageIds ?? [],
    }),
    [initialValues],
  );

  const [sourceType, setSourceType] = useState<SoundSourceType>(defaults.sourceType);
  const [errors, setErrors] = useState<SoundboardValidationError[]>([]);

  const validate = (values: SoundboardButtonFormValues) => {
    const nextErrors = validateSoundboardButton({
      title: values.title,
      sourceType: values.sourceType,
      sourceUrl: values.sourceUrl || null,
      assetId: values.assetId || null,
      volume: values.volume,
      thumbnail: values.thumbnail || null,
    });
    setErrors(nextErrors);
    return nextErrors;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const values = readFormValues(event.currentTarget);
    const nextErrors = validate(values);
    if (nextErrors.length > 0) {
      event.preventDefault();
    }
  };

  const handleFieldChange = (event: React.FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    if (target.name === "sourceType") {
      setSourceType(target.value as SoundSourceType);
    }

    validate(readFormValues(event.currentTarget));
  };

  const titleError = fieldError(errors, "title");
  const sourceUrlError = fieldError(errors, "sourceUrl");
  const assetIdError = fieldError(errors, "assetId");
  const volumeError = fieldError(errors, "volume");
  const sourceTypeError = fieldError(errors, "sourceType");

  const pageOptions = [
    ...extraLinkedPages.filter((page) => !linkablePages.some((entry) => entry.id === page.id)),
    ...linkablePages,
  ];

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
      onChange={handleFieldChange}
      noValidate
    >
      <input type="hidden" name="worldSlug" value={worldSlug} />
      {campaignSlug && <input type="hidden" name="campaignSlug" value={campaignSlug} />}
      {buttonId && <input type="hidden" name="buttonId" value={buttonId} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-title">Titel</Label>
        <Input id="soundboard-button-title" type="text" name="title" required defaultValue={defaults.title} />
        {titleError && (
          <p role="alert" className="text-sm text-destructive">
            {titleError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-sourceType">Quelle</Label>
        <select
          id="soundboard-button-sourceType"
          name="sourceType"
          value={sourceType}
          onChange={(event) => setSourceType(event.target.value as SoundSourceType)}
          className={NATIVE_SELECT_CLASS}
        >
          <option value="local">Lokale Audiodatei</option>
          <option value="youtube">YouTube-Link</option>
          <option value="spotify">Spotify-Link</option>
        </select>
        {sourceTypeError && (
          <p role="alert" className="text-sm text-destructive">
            {sourceTypeError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-assetId">Asset (lokal)</Label>
        <select
          id="soundboard-button-assetId"
          name="assetId"
          defaultValue={defaults.assetId}
          className={NATIVE_SELECT_CLASS}
        >
          <option value="">— Keins —</option>
          {audioAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.title}
            </option>
          ))}
        </select>
        {sourceType === "local" && assetIdError && (
          <p role="alert" className="text-sm text-destructive">
            {assetIdError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-sourceUrl">URL (YouTube / Spotify)</Label>
        <Input
          id="soundboard-button-sourceUrl"
          type="url"
          name="sourceUrl"
          placeholder="https://…"
          defaultValue={defaults.sourceUrl}
        />
        {sourceType === "youtube" && sourceUrlError && (
          <p role="alert" className="text-sm text-destructive">
            {sourceUrlError}
          </p>
        )}
        {sourceType === "spotify" && sourceUrlError && (
          <p role="alert" className="text-sm text-destructive">
            {sourceUrlError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-thumbnail">Thumbnail-URL (optional)</Label>
        <Input
          id="soundboard-button-thumbnail"
          type="url"
          name="thumbnail"
          placeholder={sourceType === "spotify" ? "Manuelles Cover für Spotify" : "https://…"}
          defaultValue={defaults.thumbnail}
        />
        {sourceType === "spotify" && (
          <span className="text-xs text-muted-foreground">
            Cover wird automatisch von Spotify geladen; optional kann ein eigenes Bild gesetzt werden.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-volume">Lautstärke</Label>
        <Input
          id="soundboard-button-volume"
          type="number"
          name="volume"
          min={0}
          max={1}
          step={0.05}
          defaultValue={defaults.volume}
        />
        {volumeError && (
          <p role="alert" className="text-sm text-destructive">
            {volumeError}
          </p>
        )}
      </div>

      {/* TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox]
          + Tailwind verwendet, siehe gleiches Muster in CreateWorldForm.tsx. */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="loop"
          defaultChecked={defaults.loop}
          className="size-4 rounded border-input"
        />
        Loop
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-tags">Tags (kommagetrennt)</Label>
        <Input
          id="soundboard-button-tags"
          type="text"
          name="tags"
          placeholder="ambient, kampf"
          defaultValue={defaults.tags}
        />
      </div>


      <div className="flex flex-col gap-1.5">
        <Label htmlFor="soundboard-button-linkedPageIds">
          Seiten verknüpfen (Mehrfachauswahl mit Strg/Cmd)
        </Label>
        <select
          id="soundboard-button-linkedPageIds"
          name="linkedPageIds"
          multiple
          size={Math.min(pageOptions.length, 5) || 1}
          defaultValue={defaults.linkedPageIds}
          className={NATIVE_MULTI_SELECT_CLASS}
        >
          {pageOptions.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title} ({page.type})
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
