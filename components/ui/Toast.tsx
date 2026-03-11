"use client";

// ============================================================================
// components/ui/Toast.tsx — Sistema de notificaciones ligero
//
// Uso: const { toast } = useToast();
//      toast({ message: "Guardado", variant: "success" });
// ============================================================================

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { FolderSync, Tag, X, AlertTriangle } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "info" | "warning" | "error";

interface ToastItem {
  id:       number;
  message:  string;
  variant:  ToastVariant;
  icon?:    "folder" | "tag";
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, "id">) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = ++_nextId;
    setItems((prev) => [...prev, { ...opts, id }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Render toasts */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto animate-slide-up flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm"
            style={variantStyles(t.variant)}
          >
            <ToastIcon variant={t.variant} icon={t.icon} />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function variantStyles(variant: ToastVariant): React.CSSProperties {
  const map: Record<ToastVariant, { bg: string; border: string; color: string }> = {
    success: { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.30)",  color: "#4ade80" },
    info:    { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.30)", color: "#60a5fa" },
    warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)", color: "#fbbf24" },
    error:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.30)",  color: "#f87171" },
  };
  const s = map[variant];
  return { backgroundColor: s.bg, borderColor: s.border, color: s.color };
}

function ToastIcon({ variant, icon }: { variant: ToastVariant; icon?: "folder" | "tag" }) {
  if (icon === "folder") return <FolderSync className="h-4 w-4 shrink-0" />;
  if (icon === "tag")    return <Tag className="h-4 w-4 shrink-0" />;
  if (variant === "warning" || variant === "error") return <AlertTriangle className="h-4 w-4 shrink-0" />;
  return <Tag className="h-4 w-4 shrink-0" />;
}
