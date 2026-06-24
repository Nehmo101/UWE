"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { GraphView, type GraphViewProps } from "./GraphView";

const STORAGE_KEY = "uwe-graph-height";
const MIN_HEIGHT = 320;
const DEFAULT_HEIGHT = 640;

function maxHeight(): number {
  if (typeof window === "undefined") return DEFAULT_HEIGHT;
  return window.innerHeight * 0.9;
}

function clampHeight(value: number): number {
  return Math.min(Math.max(value, MIN_HEIGHT), maxHeight());
}

function getDefaultHeight(): number {
  if (typeof window === "undefined") return DEFAULT_HEIGHT;
  return clampHeight(Math.max(DEFAULT_HEIGHT, window.innerHeight * 0.5));
}

function readStoredHeight(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? clampHeight(parsed) : null;
  } catch {
    return null;
  }
}

export type ResizableGraphViewProps = Omit<GraphViewProps, "height">;

export function ResizableGraphView({ compact, ...graphProps }: ResizableGraphViewProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    setHeight(readStoredHeight() ?? getDefaultHeight());
  }, []);

  useEffect(() => {
    const onResize = () => {
      setHeight((current) => clampHeight(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persistHeight = useCallback((next: number) => {
    const clamped = clampHeight(next);
    setHeight(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Math.round(clamped)));
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragRef.current = { startY: event.clientY, startHeight: height };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [height],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const delta = event.clientY - dragRef.current.startY;
      persistHeight(dragRef.current.startHeight + delta);
    },
    [persistHeight],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  if (compact) {
    return <GraphView compact {...graphProps} />;
  }

  const style = { "--uwe-graph-height": `${height}px` } as CSSProperties;

  return (
    <div className="uwe-graph-resizable" style={style}>
      <GraphView {...graphProps} height={height} />
      <div
        className="uwe-graph-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Graph-Höhe anpassen"
        aria-valuenow={Math.round(height)}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={Math.round(maxHeight())}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  );
}
