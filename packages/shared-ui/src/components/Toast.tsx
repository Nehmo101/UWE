"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";

export type ToastVariant = "default" | "success" | "warning" | "danger" | "info";

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  push: (toast: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: "uwe-toast",
  success: "uwe-toast uwe-toast-success",
  warning: "uwe-toast uwe-toast-warning",
  danger: "uwe-toast uwe-toast-danger",
  info: "uwe-toast uwe-toast-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="uwe-toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(VARIANT_CLASS[toast.variant ?? "default"])}
          >
            {toast.title && <strong className="uwe-toast-title">{toast.title}</strong>}
            <p className="uwe-toast-message">{toast.message}</p>
            <button
              type="button"
              className="uwe-toast-dismiss"
              aria-label="Hinweis schließen"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
