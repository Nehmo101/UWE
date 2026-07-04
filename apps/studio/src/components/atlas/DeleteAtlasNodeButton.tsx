"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAtlasNodeAction } from "@/app/atlas-actions";

export interface DeleteAtlasNodeButtonProps {
  worldSlug: string;
  nodeId: string;
  title: string;
  /** Number of nested sub-nodes that will be removed along with this node. */
  descendantCount: number;
}

/**
 * Trash button rendered per row in the atlas node list. Confirms before
 * calling `deleteAtlasNodeAction`; when the node has descendants the prompt
 * spells out how many sub-nodes will be removed too, because deletion cascades
 * over the whole subtree.
 */
export function DeleteAtlasNodeButton({
  worldSlug,
  nodeId,
  title,
  descendantCount,
}: DeleteAtlasNodeButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const message =
      descendantCount > 0
        ? `„${title}" und ${descendantCount} untergeordnete${
            descendantCount === 1 ? "n" : ""
          } Knoten wirklich löschen? Dies kann nicht rückgängig gemacht werden.`
        : `„${title}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`;
    if (!window.confirm(message)) return;

    const formData = new FormData();
    formData.set("worldSlug", worldSlug);
    formData.set("nodeId", nodeId);

    startTransition(async () => {
      await deleteAtlasNodeAction(formData);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className="uwe-v2-btn uwe-v2-btn-danger uwe-v2-btn-sm"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Knoten „${title}" löschen`}
      title="Knoten löschen"
    >
      {pending ? "…" : "🗑"}
    </button>
  );
}
