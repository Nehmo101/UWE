"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const TOPBAR_END_ID = "uwe-topbar-end";

interface TopBarSessionMountProps {
  children: ReactNode;
}

/** Mounts session chrome into the app top bar when present; fixed fallback otherwise. */
export function TopBarSessionMount({ children }: TopBarSessionMountProps) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMount(document.getElementById(TOPBAR_END_ID));
  }, []);

  if (mount) {
    return createPortal(children, mount);
  }

  return <div className="uwe-session-chrome-fallback">{children}</div>;
}

export const TOPBAR_SESSION_MOUNT_ID = TOPBAR_END_ID;
