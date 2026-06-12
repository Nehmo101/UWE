"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { LabelElement, LabelElementType } from "@uwe/database/server";

const CANVAS_W = 6;
const CANVAS_H = 4;
const PREVIEW_SCALE = 96;

interface EditorState {
  elements: LabelElement[];
  selectedId: string | null;
  past: LabelElement[][];
  future: LabelElement[][];
}

type EditorAction =
  | { type: "set_elements"; elements: LabelElement[] }
  | { type: "select"; id: string | null }
  | { type: "update_element"; id: string; patch: Partial<LabelElement> }
  | { type: "delete_selected" }
  | { type: "duplicate_selected" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; elements: LabelElement[] };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const pushPast = (elements: LabelElement[]) => ({
    ...state,
    elements,
    past: [...state.past, state.elements].slice(-50),
    future: [],
  });

  switch (action.type) {
    case "set_elements":
      return { ...state, elements: action.elements };
    case "select":
      return { ...state, selectedId: action.id };
    case "update_element":
      return pushPast(
        state.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.patch } : el,
        ),
      );
    case "delete_selected": {
      if (!state.selectedId) return state;
      return pushPast(state.elements.filter((el) => el.id !== state.selectedId));
    }
    case "duplicate_selected": {
      const selected = state.elements.find((el) => el.id === state.selectedId);
      if (!selected) return state;
      const copy: LabelElement = {
        ...selected,
        id: `el_${Date.now()}`,
        x: Math.min(selected.x + 0.1, CANVAS_W - selected.width),
        y: Math.min(selected.y + 0.1, CANVAS_H - selected.height),
      };
      return pushPast([...state.elements, copy]);
    }
    case "undo":
      if (state.past.length === 0) return state;
      return {
        ...state,
        elements: state.past[state.past.length - 1]!,
        past: state.past.slice(0, -1),
        future: [state.elements, ...state.future],
      };
    case "redo":
      if (state.future.length === 0) return state;
      return {
        ...state,
        elements: state.future[0]!,
        past: [...state.past, state.elements],
        future: state.future.slice(1),
      };
    case "reset":
      return { elements: action.elements, selectedId: null, past: [], future: [] };
    default:
      return state;
  }
}

export interface LabelEditorAsset {
  id: string;
  title: string;
  url: string;
  visibility: string;
}

interface Props {
  initialElements: LabelElement[];
  imageAssets: LabelEditorAsset[];
  snapToGrid?: boolean;
  gridSize?: number;
  showSafeArea?: boolean;
  onChange: (elements: LabelElement[]) => void;
  hiddenInputName?: string;
}

function snap(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function LabelEditor({
  initialElements,
  imageAssets,
  snapToGrid = true,
  gridSize = 0.1,
  showSafeArea = true,
  onChange,
  hiddenInputName = "elementsJson",
}: Props) {
  const [state, dispatch] = useReducer(editorReducer, {
    elements: initialElements,
    selectedId: null,
    past: [],
    future: [],
  });

  const [drag, setDrag] = useState<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: LabelElement;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChange(state.elements);
  }, [state.elements, onChange]);

  const selected = state.elements.find((el) => el.id === state.selectedId) ?? null;

  const toInches = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_H;
    return { x, y };
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!drag) return;
      const pos = toInches(event.clientX, event.clientY);
      const dx = pos.x - drag.startX;
      const dy = pos.y - drag.startY;

      if (drag.mode === "move") {
        let nx = drag.orig.x + dx;
        let ny = drag.orig.y + dy;
        if (snapToGrid) {
          nx = snap(nx, gridSize);
          ny = snap(ny, gridSize);
        }
        dispatch({
          type: "update_element",
          id: drag.id,
          patch: {
            x: Math.max(0, Math.min(nx, CANVAS_W - drag.orig.width)),
            y: Math.max(0, Math.min(ny, CANVAS_H - drag.orig.height)),
          },
        });
      } else {
        let nw = drag.orig.width + dx;
        let nh = drag.orig.height + dy;
        if (snapToGrid) {
          nw = snap(nw, gridSize);
          nh = snap(nh, gridSize);
        }
        dispatch({
          type: "update_element",
          id: drag.id,
          patch: {
            width: Math.max(0.2, Math.min(nw, CANVAS_W - drag.orig.x)),
            height: Math.max(0.15, Math.min(nh, CANVAS_H - drag.orig.y)),
          },
        });
      }
    },
    [drag, gridSize, snapToGrid, toInches],
  );

  const handlePointerUp = useCallback(() => setDrag(null), []);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [drag, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        dispatch({ type: "undo" });
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        dispatch({ type: "delete_selected" });
      }
      if (selected && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 0.2 : snapToGrid ? gridSize : 0.05;
        const patch: Partial<LabelElement> = {};
        if (event.key === "ArrowUp") patch.y = Math.max(0, selected.y - step);
        if (event.key === "ArrowDown") patch.y = Math.min(CANVAS_H - selected.height, selected.y + step);
        if (event.key === "ArrowLeft") patch.x = Math.max(0, selected.x - step);
        if (event.key === "ArrowRight") patch.x = Math.min(CANVAS_W - selected.width, selected.x + step);
        dispatch({ type: "update_element", id: selected.id, patch });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gridSize, selected, snapToGrid]);

  const addElement = (type: LabelElementType) => {
    const id = `el_${Date.now()}`;
    const base: LabelElement = {
      id,
      type,
      x: 0.3,
      y: 0.3,
      width: type === "divider" ? 5.4 : 2,
      height: type === "divider" ? 0.05 : type === "title" ? 0.4 : 1,
      zIndex: state.elements.length + 1,
      visible: true,
      text: type === "title" ? "Titel" : type === "text" ? "Text…" : undefined,
      style: {
        fontSize: type === "title" ? 14 : 10,
        fontWeight: type === "title" ? "bold" : "normal",
        textAlign: "left",
        lineHeight: 1.35,
      },
    };
    dispatch({ type: "set_elements", elements: [...state.elements, base] });
    dispatch({ type: "select", id });
  };

  const assetUrl = (assetId: string | null | undefined) =>
    imageAssets.find((a) => a.id === assetId)?.url ?? null;

  return (
    <div className="uwe-label-editor">
      <input
        type="hidden"
        name={hiddenInputName}
        value={JSON.stringify(state.elements)}
        readOnly
      />

      <div className="uwe-label-editor-toolbar">
        <button type="button" className="uwe-btn uwe-btn-sm" onClick={() => addElement("title")}>
          + Titel
        </button>
        <button type="button" className="uwe-btn uwe-btn-sm" onClick={() => addElement("text")}>
          + Text
        </button>
        <button type="button" className="uwe-btn uwe-btn-sm" onClick={() => addElement("image")}>
          + Bild
        </button>
        <button type="button" className="uwe-btn uwe-btn-sm" onClick={() => addElement("box")}>
          + Box
        </button>
        <button type="button" className="uwe-btn uwe-btn-sm" onClick={() => addElement("divider")}>
          + Linie
        </button>
        <button type="button" className="uwe-btn uwe-btn-sm" onClick={() => addElement("qr")}>
          + QR
        </button>
        <span className="uwe-label-editor-sep" />
        <button
          type="button"
          className="uwe-btn uwe-btn-sm"
          disabled={state.past.length === 0}
          onClick={() => dispatch({ type: "undo" })}
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="uwe-btn uwe-btn-sm"
          disabled={state.future.length === 0}
          onClick={() => dispatch({ type: "redo" })}
        >
          ↷ Redo
        </button>
        <button
          type="button"
          className="uwe-btn uwe-btn-sm"
          disabled={!state.selectedId}
          onClick={() => dispatch({ type: "duplicate_selected" })}
        >
          Duplizieren
        </button>
        <button
          type="button"
          className="uwe-btn uwe-btn-sm uwe-btn-danger"
          disabled={!state.selectedId}
          onClick={() => dispatch({ type: "delete_selected" })}
        >
          Löschen
        </button>
      </div>

      <div className="uwe-label-editor-workspace">
        <div
          ref={canvasRef}
          className="uwe-label-editor-canvas"
          style={{
            width: CANVAS_W * PREVIEW_SCALE,
            height: CANVAS_H * PREVIEW_SCALE,
          }}
          onClick={() => dispatch({ type: "select", id: null })}
        >
          {showSafeArea && <div className="uwe-label-editor-safe" />}
          {snapToGrid && <div className="uwe-label-editor-grid" />}

          {state.elements
            .filter((el) => el.visible)
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((element) => {
              const isSelected = element.id === state.selectedId;
              const imgUrl = assetUrl(element.imageAssetId);

              return (
                <div
                  key={element.id}
                  className={`uwe-label-editor-element uwe-label-el-${element.type}${isSelected ? " is-selected" : ""}${element.dmOnly ? " is-dm-only" : ""}`}
                  style={{
                    left: `${(element.x / CANVAS_W) * 100}%`,
                    top: `${(element.y / CANVAS_H) * 100}%`,
                    width: `${(element.width / CANVAS_W) * 100}%`,
                    height: `${(element.height / CANVAS_H) * 100}%`,
                    zIndex: element.zIndex,
                    fontSize: element.style?.fontSize ? `${element.style.fontSize}pt` : undefined,
                    fontWeight: element.style?.fontWeight,
                    fontStyle: element.style?.fontStyle,
                    textAlign: element.style?.textAlign,
                    lineHeight: element.style?.lineHeight,
                    color: element.style?.color,
                    backgroundColor: element.style?.backgroundColor,
                    borderWidth: element.style?.borderWidth,
                    borderColor: element.style?.borderColor,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch({ type: "select", id: element.id });
                  }}
                  onPointerDown={(event) => {
                    if (element.locked) return;
                    event.stopPropagation();
                    const pos = toInches(event.clientX, event.clientY);
                    setDrag({
                      id: element.id,
                      mode: "move",
                      startX: pos.x,
                      startY: pos.y,
                      orig: element,
                    });
                  }}
                >
                  {element.type === "image" && imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt={element.imageAlt ?? ""} draggable={false} />
                  ) : element.type === "image" ? (
                    <span className="uwe-label-editor-placeholder">Bild wählen →</span>
                  ) : element.type === "divider" ? (
                    <hr />
                  ) : element.type === "qr" ? (
                    <span className="uwe-label-editor-placeholder">QR: {element.url || "URL…"}</span>
                  ) : (
                    <span>{element.text}</span>
                  )}

                  {isSelected && (
                    <span
                      className="uwe-label-editor-resize"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        const pos = toInches(event.clientX, event.clientY);
                        setDrag({
                          id: element.id,
                          mode: "resize",
                          startX: pos.x,
                          startY: pos.y,
                          orig: element,
                        });
                      }}
                    />
                  )}
                </div>
              );
            })}
        </div>

        <aside className="uwe-label-editor-props">
          <h3>Eigenschaften</h3>
          {!selected && <p className="uwe-table-sub">Element auswählen</p>}
          {selected && (
            <div className="uwe-form-grid uwe-form-grid-compact">
              <label>
                Typ
                <input type="text" value={selected.type} readOnly />
              </label>
              <label>
                X (in)
                <input
                  type="number"
                  step="0.05"
                  value={selected.x}
                  onChange={(e) =>
                    dispatch({
                      type: "update_element",
                      id: selected.id,
                      patch: { x: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label>
                Y (in)
                <input
                  type="number"
                  step="0.05"
                  value={selected.y}
                  onChange={(e) =>
                    dispatch({
                      type: "update_element",
                      id: selected.id,
                      patch: { y: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label>
                Breite
                <input
                  type="number"
                  step="0.05"
                  value={selected.width}
                  onChange={(e) =>
                    dispatch({
                      type: "update_element",
                      id: selected.id,
                      patch: { width: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label>
                Höhe
                <input
                  type="number"
                  step="0.05"
                  value={selected.height}
                  onChange={(e) =>
                    dispatch({
                      type: "update_element",
                      id: selected.id,
                      patch: { height: Number(e.target.value) },
                    })
                  }
                />
              </label>
              {(selected.type === "title" || selected.type === "text") && (
                <>
                  <label className="uwe-span-2">
                    Text
                    <textarea
                      rows={4}
                      value={selected.text ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "update_element",
                          id: selected.id,
                          patch: { text: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Schriftgröße
                    <input
                      type="number"
                      min={6}
                      max={24}
                      value={selected.style?.fontSize ?? 10}
                      onChange={(e) =>
                        dispatch({
                          type: "update_element",
                          id: selected.id,
                          patch: {
                            style: { ...selected.style, fontSize: Number(e.target.value) },
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Ausrichtung
                    <select
                      value={selected.style?.textAlign ?? "left"}
                      onChange={(e) =>
                        dispatch({
                          type: "update_element",
                          id: selected.id,
                          patch: {
                            style: {
                              ...selected.style,
                              textAlign: e.target.value as "left" | "center" | "right",
                            },
                          },
                        })
                      }
                    >
                      <option value="left">Links</option>
                      <option value="center">Mitte</option>
                      <option value="right">Rechts</option>
                    </select>
                  </label>
                  <label className="uwe-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.style?.fontWeight === "bold"}
                      onChange={(e) =>
                        dispatch({
                          type: "update_element",
                          id: selected.id,
                          patch: {
                            style: {
                              ...selected.style,
                              fontWeight: e.target.checked ? "bold" : "normal",
                            },
                          },
                        })
                      }
                    />
                    Fett
                  </label>
                  <label className="uwe-checkbox">
                    <input
                      type="checkbox"
                      checked={selected.style?.fontStyle === "italic"}
                      onChange={(e) =>
                        dispatch({
                          type: "update_element",
                          id: selected.id,
                          patch: {
                            style: {
                              ...selected.style,
                              fontStyle: e.target.checked ? "italic" : "normal",
                            },
                          },
                        })
                      }
                    />
                    Kursiv
                  </label>
                </>
              )}
              {selected.type === "image" && (
                <>
                  <label className="uwe-span-2">
                    Bild
                    <select
                      value={selected.imageAssetId ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "update_element",
                          id: selected.id,
                          patch: { imageAssetId: e.target.value || null },
                        })
                      }
                    >
                      <option value="">— Kein Bild —</option>
                      {imageAssets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.title}
                          {asset.visibility === "dm_only" ? " (DM)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="uwe-span-2">
                    Alt-Text
                    <input
                      type="text"
                      value={selected.imageAlt ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "update_element",
                          id: selected.id,
                          patch: { imageAlt: e.target.value },
                        })
                      }
                    />
                  </label>
                </>
              )}
              {selected.type === "qr" && (
                <label className="uwe-span-2">
                  URL
                  <input
                    type="url"
                    value={selected.url ?? ""}
                    onChange={(e) =>
                      dispatch({
                        type: "update_element",
                        id: selected.id,
                        patch: { url: e.target.value },
                      })
                    }
                  />
                </label>
              )}
              <label className="uwe-checkbox">
                <input
                  type="checkbox"
                  checked={selected.visible}
                  onChange={(e) =>
                    dispatch({
                      type: "update_element",
                      id: selected.id,
                      patch: { visible: e.target.checked },
                    })
                  }
                />
                Sichtbar
              </label>
              <label className="uwe-checkbox uwe-text-warning">
                <input
                  type="checkbox"
                  checked={selected.dmOnly ?? false}
                  onChange={(e) =>
                    dispatch({
                      type: "update_element",
                      id: selected.id,
                      patch: { dmOnly: e.target.checked },
                    })
                  }
                />
                DM-only
              </label>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
