"use client";

// ============================================================================
// app/contactos/_modules/ficha/ClassificationPanel.tsx
//
// Panel de clasificación Drag & Drop integrado en la ficha del contacto.
// Combina: Tag Palette (fuente draggable) + Drop Zone (receptor) + Tags asignados.
//
// @role: @Frontend-UX + @Doc-Specialist
// @spec: Fase 3.3 — Protocolo de Interfaz Operativa
//
// REGLAS:
//   · Las etiquetas "Constructor" (📂 Departamento/Servicio) disparan @File-Mirror mock
//   · Las etiquetas "Atributo" (🏷️ Identidad/Estado/Inteligencia) solo vinculan metadato
//   · El TagSelector por click sigue funcionando como backup
//   · La Drop Zone se ilumina al recibir un drag-over
// ============================================================================

import { useState, useEffect, useTransition, useCallback } from "react";
import { Folder, Tag, X, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useTenant } from "@/lib/context/TenantContext";
import { useToast } from "@/components/ui/Toast";
import { DropZone, type DropPayload } from "@/components/ui/DropZone";
import { getCategoriaTipo, isConstructor } from "@/lib/config/categoriaTipos";
import {
  getEtiquetasByTenant,
  getEtiquetasDeEntidad,
  asignarEtiqueta,
  desasignarEtiqueta,
} from "@/lib/modules/entidades/actions/etiquetas.actions";
import { createDriveFolder } from "@/lib/services/driveMock.service";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EtiquetaOption {
  id:         string;
  nombre:     string;
  color:      string;
  es_sistema: boolean;
  scope:      string;
  categoria:  { id: string; nombre: string };
}

interface CategoriaGroup {
  id:        string;
  nombre:    string;
  etiquetas: EtiquetaOption[];
}

interface AssignedTag {
  id:          string;
  etiqueta_id: string;
  etiqueta:    {
    id:        string;
    nombre:    string;
    color:     string;
    categoria: { id: string; nombre: string };
  };
}

interface ClassificationPanelProps {
  contactoId:   string;
  contactoName: string;
}

// Orden visual: constructores primero, luego atributos
const ORDEN_VISUAL: Record<string, number> = {
  "Departamento": 1,
  "Servicio":     2,
  "Identidad":    3,
  "Estado":       4,
  "Inteligencia": 5,
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function ClassificationPanel({ contactoId, contactoName }: ClassificationPanelProps) {
  const { tenant, isSuperAdmin } = useTenant();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // State
  const [grupos, setGrupos]           = useState<CategoriaGroup[]>([]);
  const [assigned, setAssigned]       = useState<AssignedTag[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Load tags on mount and tenant change
  useEffect(() => {
    startTransition(async () => {
      const [gruposRes, assignedRes] = await Promise.all([
        getEtiquetasByTenant(tenant.scope, isSuperAdmin),
        getEtiquetasDeEntidad(contactoId, "CONTACTO"),
      ]);
      if (gruposRes.ok) {
        const sorted = (gruposRes.data as CategoriaGroup[]).sort(
          (a, b) => (ORDEN_VISUAL[a.nombre] ?? 99) - (ORDEN_VISUAL[b.nombre] ?? 99)
        );
        setGrupos(sorted);
      }
      if (assignedRes.ok) setAssigned(assignedRes.data as unknown as AssignedTag[]);
    });
  }, [tenant.scope, isSuperAdmin, contactoId]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const isAlreadyAssigned = useCallback(
    (etiquetaId: string) => assigned.some((a) => a.etiqueta_id === etiquetaId),
    [assigned]
  );

  async function handleDrop(payload: DropPayload) {
    if (isAlreadyAssigned(payload.id)) {
      toast({ message: `"${payload.nombre}" ya está asignada`, variant: "warning", icon: "tag" });
      return;
    }

    // Assign the tag via Prisma
    const result = await asignarEtiqueta(payload.id, contactoId, "CONTACTO");
    if (!result.ok) {
      toast({ message: result.error, variant: "error" });
      return;
    }

    // If Constructor → mock Drive folder creation
    if (payload.categoriaTipo === "CONSTRUCTOR") {
      const driveResult = await createDriveFolder({
        contactoId,
        contactoName,
        categoriaNombre: payload.categoriaNombre,
        etiquetaNombre:  payload.nombre,
      });
      if (driveResult.success) {
        toast({
          message: `[SIMULACION] Carpeta preparada para sincronizacion en Drive: ${driveResult.path}`,
          variant: "info",
          icon: "folder",
        });
      }
    } else {
      toast({ message: `Atributo "${payload.nombre}" guardado`, variant: "success", icon: "tag" });
    }

    // Refresh assigned
    const refreshed = await getEtiquetasDeEntidad(contactoId, "CONTACTO");
    if (refreshed.ok) setAssigned(refreshed.data as unknown as AssignedTag[]);
  }

  async function handleRemove(etiquetaId: string, nombre: string) {
    const result = await desasignarEtiqueta(etiquetaId, contactoId, "CONTACTO");
    if (result.ok) {
      setAssigned((prev) => prev.filter((a) => a.etiqueta_id !== etiquetaId));
      toast({ message: `"${nombre}" desvinculada`, variant: "info", icon: "tag" });
    }
  }

  async function handlePaletteClick(etiqueta: EtiquetaOption) {
    if (isAlreadyAssigned(etiqueta.id)) return;

    const catTipo = getCategoriaTipo(etiqueta.categoria.nombre);

    const result = await asignarEtiqueta(etiqueta.id, contactoId, "CONTACTO");
    if (!result.ok) {
      toast({ message: result.error, variant: "error" });
      return;
    }

    if (catTipo === "CONSTRUCTOR") {
      const driveResult = await createDriveFolder({
        contactoId,
        contactoName,
        categoriaNombre: etiqueta.categoria.nombre,
        etiquetaNombre:  etiqueta.nombre,
      });
      if (driveResult.success) {
        toast({
          message: `[SIMULACION] Carpeta preparada para sincronizacion en Drive: ${driveResult.path}`,
          variant: "info",
          icon: "folder",
        });
      }
    } else {
      toast({ message: `Atributo "${etiqueta.nombre}" guardado`, variant: "success", icon: "tag" });
    }

    const refreshed = await getEtiquetasDeEntidad(contactoId, "CONTACTO");
    if (refreshed.ok) setAssigned(refreshed.data as unknown as AssignedTag[]);
  }

  // ─── Drag start helper for palette items ──────────────────────────────────

  function makeDragData(e: EtiquetaOption): string {
    const payload: DropPayload = {
      id:              e.id,
      nombre:          e.nombre,
      color:           e.color,
      categoriaNombre: e.categoria.nombre,
      categoriaTipo:   getCategoriaTipo(e.categoria.nombre),
    };
    return JSON.stringify(payload);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* ── Etiquetas asignadas ──────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Clasificacion
        </p>
        {assigned.length === 0 && !isPending ? (
          <p className="text-xs text-zinc-600">Sin etiquetas asignadas</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assigned.map((a) => {
              const catTipo = getCategoriaTipo(a.etiqueta.categoria.nombre);
              return (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset"
                  style={{
                    backgroundColor: `${a.etiqueta.color}18`,
                    color: a.etiqueta.color,
                  }}
                >
                  {catTipo === "CONSTRUCTOR" ? (
                    <Folder className="h-2.5 w-2.5" />
                  ) : (
                    <Tag className="h-2.5 w-2.5" />
                  )}
                  {a.etiqueta.nombre}
                  <button
                    onClick={() => handleRemove(a.etiqueta_id, a.etiqueta.nombre)}
                    className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Drop Zone ────────────────────────────────────────────────────── */}
      <DropZone
        onDrop={handleDrop}
        accentColor={tenant.color}
        disabled={isPending}
      />

      {/* ── Tag Palette (toggle) ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setPaletteOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
      >
        <span className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Paleta de etiquetas
          {isPending && <span className="animate-pulse text-zinc-600">(cargando...)</span>}
        </span>
        {paletteOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {paletteOpen && (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 py-1">
          {grupos.map((grupo, idx) => {
            const catTipo = getCategoriaTipo(grupo.nombre);
            const IconComponent = catTipo === "CONSTRUCTOR" ? Folder : Tag;
            const prevOrden = idx > 0 ? (ORDEN_VISUAL[grupos[idx - 1]?.nombre] ?? 0) : 0;
            const currOrden = ORDEN_VISUAL[grupo.nombre] ?? 0;
            const showSeparator = prevOrden <= 2 && currOrden >= 3;
            return (
              <div key={grupo.id}>
                {showSeparator && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="h-px flex-1 bg-zinc-700/40" />
                    <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">Atributos</span>
                    <div className="h-px flex-1 bg-zinc-700/40" />
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                  <IconComponent
                    className="h-3 w-3"
                    style={{ color: catTipo === "CONSTRUCTOR" ? "#f59e0b" : "#8b5cf6" }}
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                    {grupo.nombre}
                  </p>
                  <span className="text-[9px] text-zinc-700">
                    {catTipo === "CONSTRUCTOR" ? "Constructor" : "Atributo"}
                  </span>
                </div>
                {grupo.etiquetas.map((e) => {
                  const alreadyAssigned = isAlreadyAssigned(e.id);
                  return (
                    <div
                      key={e.id}
                      draggable={!alreadyAssigned}
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData("text/plain", makeDragData(e));
                        ev.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handlePaletteClick(e)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                        alreadyAssigned
                          ? "opacity-40 cursor-default"
                          : "cursor-grab hover:bg-zinc-900 active:cursor-grabbing"
                      }`}
                    >
                      <GripVertical className="h-3 w-3 text-zinc-700 shrink-0" />
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/10"
                        style={{ backgroundColor: e.color }}
                      />
                      <span className={alreadyAssigned ? "text-zinc-600 line-through" : "text-zinc-300"}>
                        {e.nombre}
                      </span>
                      {catTipo === "CONSTRUCTOR" ? (
                        <Folder className="ml-auto h-3 w-3 text-amber-500/50" />
                      ) : (
                        <Tag className="ml-auto h-3 w-3 text-violet-500/50" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
