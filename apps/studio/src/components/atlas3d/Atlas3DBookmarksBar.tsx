"use client";

import { useState, type RefObject } from "react";
import type { Atlas3DEditorApp } from "@uwe/atlas-3d/editor-app";
import { saveAtlas3DBookmarksAction } from "@/app/atlas3d-actions";

export interface Atlas3DBookmarkItem {
  id: string;
  name: string;
  pose: unknown;
}

export interface Atlas3DBookmarksBarProps {
  worldSlug: string;
  nodeId: string;
  bookmarks: Atlas3DBookmarkItem[];
  appRef: RefObject<Atlas3DEditorApp | null>;
  onSaved: () => void;
}

/** Camera-bookmark strip — extracted from the shell for the file-size budget. */
export function Atlas3DBookmarksBar(props: Atlas3DBookmarksBarProps) {
  const [bookmarkName, setBookmarkName] = useState("");

  return (
    <div className="atlas3d-region" data-testid="atlas3d-bookmarks">
      <span>📷 Kamera-Lesezeichen:</span>
      {props.bookmarks.map((bookmark) => (
        <button
          key={bookmark.id}
          type="button"
          className="atlas3d-tool"
          onClick={() => {
            const pose = bookmark.pose as { theta?: number; phi?: number; distance?: number; target?: [number, number, number] };
            props.appRef.current?.flyTo(pose);
          }}
        >
          {bookmark.name}
        </button>
      ))}
      <input
        type="text"
        placeholder="Name"
        value={bookmarkName}
        data-testid="atlas3d-bookmark-name"
        onChange={(event) => setBookmarkName(event.target.value)}
      />
      <button
        type="button"
        className="atlas3d-tool"
        data-testid="atlas3d-bookmark-add"
        disabled={bookmarkName.trim().length === 0}
        onClick={() => {
          const pose = props.appRef.current?.getCameraPose();
          if (!pose) return;
          const form = new FormData();
          form.set("worldSlug", props.worldSlug);
          form.set("nodeId", props.nodeId);
          form.set(
            "bookmarks",
            JSON.stringify([...props.bookmarks.map((b) => ({ name: b.name, pose: b.pose })), { name: bookmarkName.trim(), pose }]),
          );
          saveAtlas3DBookmarksAction(form).then((result) => {
            if (result.ok) {
              setBookmarkName("");
              props.onSaved();
            }
          });
        }}
      >
        + Blick merken
      </button>
    </div>
  );
}
