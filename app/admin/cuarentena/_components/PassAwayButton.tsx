"use client";

// ============================================================================
// app/admin/cuarentena/_components/PassAwayButton.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Guardian Dashboard — Borrado físico QUARANTINE + Certificado RGPD
//
// El botón está VETADO (disabled) si hay expedientes activos.
// Confirmación de 2 pasos antes de ejecutar el borrado físico.
// Tras el borrado muestra el Certificado de Borrado con el hash SHA-256.
// ============================================================================

import { useState, useTransition } from "react";
import { Skull, AlertTriangle, ShieldX, ShieldCheck, Copy, Check } from "lucide-react";
import { passAwayContacto } from "@/lib/modules/entidades/actions/contactos.actions";
import { useRouter } from "next/navigation";

interface PassAwayButtonProps {
  contactoId:      string;
  /** Pre-calculado desde el RSC para evitar round-trip en el caso obvio. */
  expedientesCount: number;
}

export function PassAwayButton({ contactoId, expedientesCount }: PassAwayButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [vetoReasons, setVetoReasons] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<{ hash: string; timestamp: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const isVetoed = expedientesCount > 0;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await passAwayContacto(contactoId);
      if (!result.ok) {
        if (result.vetoReasons) {
          setVetoReasons(result.vetoReasons);
        } else {
          setError(result.error);
        }
        setShowConfirm(false);
        return;
      }
      setCertificate({ hash: result.hash_identificador, timestamp: new Date().toISOString() });
      setShowConfirm(false);
    });
  }

  function handleCopy(hash: string) {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // — Certificado de Borrado (RGPD) —
  if (certificate) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 max-w-xs">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-emerald-400">Certificado de Borrado</p>
            <p className="mt-0.5 text-[10px] text-emerald-600">
              {new Date(certificate.timestamp).toLocaleString("es-ES")}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <code className="flex-1 truncate rounded bg-zinc-900 px-1.5 py-1 font-mono text-[9px] text-emerald-300">
                {certificate.hash}
              </code>
              <button
                onClick={() => handleCopy(certificate.hash)}
                className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:text-emerald-400"
                title="Copiar hash"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-600">
              SHA-256 verificable. Sin datos personales. Base legal: RGPD Art.17.
            </p>
            <button
              onClick={() => router.refresh()}
              className="mt-2 text-[10px] text-zinc-500 underline hover:text-zinc-300"
            >
              Actualizar listado
            </button>
          </div>
        </div>
      </div>
    );
  }

  // — Vetoed: mostrar motivos de bloqueo —
  if (vetoReasons) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-950/20 p-3">
        <div className="flex items-start gap-2">
          <ShieldX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <div>
            <p className="text-[11px] font-semibold text-red-400">Vetado por el Agente Legal</p>
            <ul className="mt-1 space-y-0.5">
              {vetoReasons.map((r, i) => (
                <li key={i} className="text-[10px] text-red-500/70">{r}</li>
              ))}
            </ul>
            <button
              onClick={() => setVetoReasons(null)}
              className="mt-2 text-[10px] text-zinc-500 underline hover:text-zinc-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // — Confirmación —
  if (showConfirm) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-300">¿Confirmar Pass Away?</p>
            <p className="mt-0.5 text-[11px] text-red-400/70 leading-relaxed">
              Borrado físico irreversible. Se generará un certificado RGPD.
            </p>
            {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex items-center gap-1 rounded bg-red-500/20 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50"
              >
                <Skull className={`h-3 w-3 ${isPending ? "animate-pulse" : ""}`} />
                {isPending ? "Ejecutando…" : "Confirmar"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="rounded px-2.5 py-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // — Estado inicial —
  if (isVetoed) {
    return (
      <div title={`Vetado: ${expedientesCount} expediente(s) activo(s)`}>
        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg border border-red-500/10 px-3 py-1.5 text-xs font-medium text-red-900 cursor-not-allowed opacity-40"
        >
          <ShieldX className="h-3.5 w-3.5" />
          Pass Away
        </button>
        <p className="mt-0.5 text-[10px] text-red-600">
          {expedientesCount} exp. activo{expedientesCount !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20"
    >
      <Skull className="h-3.5 w-3.5" />
      Pass Away
    </button>
  );
}
