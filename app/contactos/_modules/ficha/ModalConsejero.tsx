"use client";

// ============================================================================
// app/contactos/_modules/ficha/ModalConsejero.tsx — Consejero de Estructura
//
// @role: @Frontend-UX / @Doc-Specialist
// @spec: PASO C — Modal educativo de elección: Expediente vs Carpeta Manual
//
// UX educativa: explica las ventajas/inconvenientes de cada opción.
//   - Expediente (carpeta inteligente) → vinculada a etiqueta, con blueprint
//   - Carpeta Manual → libre, sin estructura predefinida
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Briefcase, FolderPlus, Zap, Check, AlertTriangle } from "lucide-react";
import { createCarpetaManual } from "@/lib/modules/entidades/actions/boveda.actions";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface ModalConsejeroProps {
  open:        boolean;
  onClose:     () => void;
  contactoId:  string;
  onCreated?:  () => void;
}

type Opcion = "expediente" | "manual" | null;

// ─── Ventajas/Inconvenientes ────────────────────────────────────────────────

const EXPEDIENTE_PROS = [
  "Estructura automatica basada en el servicio contratado",
  "Subcarpetas de blueprint inmutables (no se pierden)",
  "Vinculacion directa con etiquetas y expedientes",
  "Trazabilidad completa en el sistema SALI",
];

const EXPEDIENTE_CONS = [
  "Requiere asignar una etiqueta de Departamento/Servicio al contacto",
  "La estructura no se puede modificar libremente",
];

const MANUAL_PROS = [
  "Total libertad para organizar documentos como quieras",
  "No requiere etiquetas ni configuracion previa",
  "Ideal para documentos temporales o inclasificables",
];

const MANUAL_CONS = [
  "Sin estructura predefinida: el orden depende de ti",
  "No se vincula automaticamente a expedientes",
  "Sin subcarpetas de blueprint (menos consistencia)",
];

// ─── Componente ─────────────────────────────────────────────────────────────

export function ModalConsejero({ open, onClose, contactoId, onCreated }: ModalConsejeroProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Opcion>(null);
  const [step, setStep] = useState<"choose" | "create-manual">("choose");
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleClose() {
    setSelected(null);
    setStep("choose");
    setFolderName("");
    setError(null);
    onClose();
  }

  function handleConfirm() {
    if (selected === "expediente") {
      // Navegar al panel de clasificación para asignar etiquetas
      handleClose();
      // El usuario debe asignar etiquetas Constructor desde el panel SALI
      // que generará automáticamente las carpetas inteligentes
      router.push(`/contactos/${contactoId}?tab=identity`);
    } else if (selected === "manual") {
      setStep("create-manual");
    }
  }

  async function handleCreateManual() {
    if (!folderName.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createCarpetaManual(contactoId, folderName.trim());
    setCreating(false);
    if (result.ok) {
      onCreated?.();
      handleClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">
              {step === "choose" ? "Consejero de Estructura" : "Nueva Carpeta Manual"}
            </h2>
            <p className="text-[11px] text-zinc-500">
              {step === "choose"
                ? "Elige como quieres organizar los documentos de este contacto."
                : "Crea una carpeta libre para organizar documentos."}
            </p>
          </div>
          <button onClick={handleClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {step === "choose" ? (
            <div className="space-y-3">
              {/* Opción: Expediente (inteligente) */}
              <button
                onClick={() => setSelected("expediente")}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  selected === "expediente"
                    ? "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    selected === "expediente" ? "bg-blue-500/20" : "bg-zinc-800"
                  }`}>
                    <Briefcase className={`h-4 w-4 ${selected === "expediente" ? "text-blue-400" : "text-zinc-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-200">Carpeta Inteligente (Expediente)</span>
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 uppercase">Recomendado</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                      Asigna una etiqueta de Departamento o Servicio y el sistema generara
                      automaticamente la estructura de carpetas con subcarpetas de blueprint.
                    </p>

                    {selected === "expediente" && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Ventajas</p>
                          {EXPEDIENTE_PROS.map((pro) => (
                            <div key={pro} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                              <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{pro}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1">Consideraciones</p>
                          {EXPEDIENTE_CONS.map((con) => (
                            <div key={con} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
                              <AlertTriangle className="h-3 w-3 text-amber-500/70 shrink-0 mt-0.5" />
                              <span>{con}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Opción: Manual */}
              <button
                onClick={() => setSelected("manual")}
                className={`w-full rounded-lg border p-4 text-left transition-all ${
                  selected === "manual"
                    ? "border-zinc-500/50 bg-zinc-500/5 ring-1 ring-zinc-500/20"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    selected === "manual" ? "bg-zinc-600/20" : "bg-zinc-800"
                  }`}>
                    <FolderPlus className={`h-4 w-4 ${selected === "manual" ? "text-zinc-300" : "text-zinc-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-zinc-200">Carpeta Manual</span>
                    <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                      Crea una carpeta libre sin vinculos a etiquetas. Ideal para documentos
                      temporales, adjuntos sueltos o clasificaciones personalizadas.
                    </p>

                    {selected === "manual" && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Ventajas</p>
                          {MANUAL_PROS.map((pro) => (
                            <div key={pro} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                              <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{pro}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1">Consideraciones</p>
                          {MANUAL_CONS.map((con) => (
                            <div key={con} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
                              <AlertTriangle className="h-3 w-3 text-amber-500/70 shrink-0 mt-0.5" />
                              <span>{con}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          ) : (
            /* Step: create-manual */
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400">Nombre de la carpeta</label>
                <input
                  autoFocus
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateManual(); }}
                  placeholder="Ej: Documentos Varios, Adjuntos Reunión..."
                  className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600"
                />
              </div>
              {error && (
                <p className="text-[11px] text-red-400">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          {step === "create-manual" && (
            <button
              onClick={() => { setStep("choose"); setFolderName(""); setError(null); }}
              className="rounded-md px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300"
            >
              Volver
            </button>
          )}
          <button
            onClick={handleClose}
            className="rounded-md px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300"
          >
            Cancelar
          </button>
          {step === "choose" ? (
            <button
              onClick={handleConfirm}
              disabled={!selected}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selected === "expediente" ? "Ir al clasificador" : selected === "manual" ? "Siguiente" : "Elegir opcion"}
            </button>
          ) : (
            <button
              onClick={handleCreateManual}
              disabled={!folderName.trim() || creating}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating && <Zap className="h-3 w-3 animate-pulse" />}
              Crear carpeta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
