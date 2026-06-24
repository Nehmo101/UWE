"use client";

import { useMemo, useState } from "react";
import { VISIBILITY_LABELS } from "@uwe/shared-ui";
import {
  validateSoundboardButton,
  type SoundSourceType,
  type SoundboardValidationError,
} from "@uwe/soundboard";

export interface SoundboardButtonFormValues {
  title: string;
  sourceType: SoundSourceType;
  sourceUrl: string;
  assetId: string;
  thumbnail: string;
  volume: number;
  loop: boolean;
  tags: string;
  visibility: string;
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
    visibility: String(formData.get("visibility") ?? "dm_only"),
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
      visibility: initialValues?.visibility ?? "dm_only",
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
      className="uwe-form-grid"
      onSubmit={handleSubmit}
      onChange={handleFieldChange}
      noValidate
    >
      <input type="hidden" name="worldSlug" value={worldSlug} />
      {campaignSlug && <input type="hidden" name="campaignSlug" value={campaignSlug} />}
      {buttonId && <input type="hidden" name="buttonId" value={buttonId} />}

      <label>
        Titel
        <input type="text" name="title" required defaultValue={defaults.title} />
        {titleError && <span className="uwe-form-error">{titleError}</span>}
      </label>

      <label>
        Quelle
        <select
          name="sourceType"
          value={sourceType}
          onChange={(event) => setSourceType(event.target.value as SoundSourceType)}
        >
          <option value="local">Lokale Audiodatei</option>
          <option value="youtube">YouTube-Link</option>
          <option value="spotify">Spotify-Link</option>
        </select>
        {sourceTypeError && <span className="uwe-form-error">{sourceTypeError}</span>}
      </label>

      <label>
        Asset (lokal)
        <select name="assetId" defaultValue={defaults.assetId}>
          <option value="">— Keins —</option>
          {audioAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.title}
            </option>
          ))}
        </select>
        {sourceType === "local" && assetIdError && (
          <span className="uwe-form-error">{assetIdError}</span>
        )}
      </label>

      <label>
        URL (YouTube / Spotify)
        <input
          type="url"
          name="sourceUrl"
          placeholder="https://…"
          defaultValue={defaults.sourceUrl}
        />
        {sourceType === "youtube" && sourceUrlError && (
          <span className="uwe-form-error">{sourceUrlError}</span>
        )}
        {sourceType === "spotify" && sourceUrlError && (
          <span className="uwe-form-error">{sourceUrlError}</span>
        )}
      </label>

      <label>
        Thumbnail-URL (optional)
        <input
          type="url"
          name="thumbnail"
          placeholder={sourceType === "spotify" ? "Manuelles Cover für Spotify" : "https://…"}
          defaultValue={defaults.thumbnail}
        />
        {sourceType === "spotify" && (
          <span className="uwe-table-sub">
            Cover wird automatisch von Spotify geladen; optional kann ein eigenes Bild gesetzt werden.
          </span>
        )}
      </label>

      <label>
        Lautstärke
        <input
          type="number"
          name="volume"
          min={0}
          max={1}
          step={0.05}
          defaultValue={defaults.volume}
        />
        {volumeError && <span className="uwe-form-error">{volumeError}</span>}
      </label>

      <label>
        <input type="checkbox" name="loop" defaultChecked={defaults.loop} /> Loop
      </label>

      <label>
        Tags (kommagetrennt)
        <input type="text" name="tags" placeholder="ambient, kampf" defaultValue={defaults.tags} />
      </label>

      <label>
        Sichtbarkeit
        <select name="visibility" defaultValue={defaults.visibility}>
          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="uwe-form-hint">
          „Portal (ohne Login)“ ist im Spielerportal ohne Login sichtbar. DM-only Sounds erscheinen
          dort nicht — Playback-Steuerung (insbesondere Spotify) bleibt Studio-seitig.
        </span>
      </label>

      <label>
        Seiten verknüpfen (Mehrfachauswahl mit Strg/Cmd)
        <select
          name="linkedPageIds"
          multiple
          size={Math.min(pageOptions.length, 5) || 1}
          defaultValue={defaults.linkedPageIds}
        >
          {pageOptions.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title} ({page.type})
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}
