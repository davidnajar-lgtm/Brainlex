// ============================================================================
// app/contactos/[id]/_components/RestoreButton.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 1.2 — Restauración QUARANTINE → ACTIVE desde la Ficha
//
// Solo se monta si el Contacto está en QUARANTINE.
// Llama a restoreContacto() Server Action con confirmación explícita.
// ============================================================================
"use client";

import { useState, useTransition } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { restoreContacto } from "@/lib/actions/contactos.actions";
import { useRouter } from "next/navigation";
import { getContactosLabels, type AppLocale } from "@/lib/i18n/contactos";

export function RestoreButton({
  contactoId,
  locale = "es",
}: {
  contactoId: string;
  locale?:    AppLocale;
}) {
  const t = getContactosLabels(locale);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await restoreContacto(contactoId);
      if (!result.ok) {
        setError(result.error);
        setShowConfirm(false);
        return;
      }
      // Refresh RSC data tras restauración exitosa
      router.refresh();
    });
  }

  if (showConfirm) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">
              {t.restore.confirmTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-400/70">
              {t.restore.confirmDesc}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                {isPending ? t.restore.restoring : t.restore.confirmYes}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
              >
                {t.restore.confirmNo}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setShowConfirm(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:border-amber-500/50 hover:bg-amber-500/20"
      >
        <RotateCcw className="h-4 w-4" />
        {t.restore.label}
      </button>
      {error && (
        <p className="text-center text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
