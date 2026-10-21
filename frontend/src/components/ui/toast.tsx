"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const TONES: Record<ToastTone, string> = {
  success: "border-success/30 bg-success-mist text-green-900",
  error: "border-danger/30 bg-danger-mist text-red-900",
  info: "border-brand-light/40 bg-brand-mist text-brand-dark",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const t = useT();

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = Date.now() + Math.random();
      setItems((current) => [...current.slice(-3), { id, tone, message: t(message) }]);
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4500);
    },
    [dismiss, t],
  );

  const value = useMemo<ToastApi>(
    () => ({
      toast,
      success: (message: string) => toast(message, "success"),
      error: (message: string) => toast(message, "error"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
      >
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow-lift)]",
                TONES[item.tone],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label={t("Dismiss notification")}
                className="rounded-full p-0.5 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
