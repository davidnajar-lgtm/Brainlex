"use client";

// ============================================================================
// app/contactos/_modules/ficha/CommandCenter.tsx — CORE-DROP v3
//
// Consola de mando: 3 columnas fijas a 100vh, sin scroll global.
//
//   COL-IZQ (45%)    — Ficha del contacto (RSC children) — consulta
//   COL-CENTRO (25%) — DROP ZONE compacta + tags asignados — impacto
//   COL-DER (30%)    — Taxonomia: 5 cajones SALI (HARD-CODED) — fuente
//
// PURGA: Solo 5 categorias validas (Identidad, Departamento, Servicio,
//        Estado, Inteligencia). Cualquier otra se oculta.
//
// Flujo: DERECHA → CENTRO (drag de etiqueta al drop zone)
//
// @role: @Frontend-UX
// @spec: Fase 4.3 — Limpieza taxonomica + ajuste proporciones
// ============================================================================

import { useState, useEffect, useTransition, useCallback, createContext, useContext, type ReactNode, type DragEvent } from "react";
import { Folder, FolderLock, Tag, X, Pencil, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTenant } from "@/lib/context/TenantContext";
import { useToast } from "@/components/ui/Toast";
import { getCategoriaTipo } from "@/lib/config/categoriaTipos";
import {
  getEtiquetasByTenant,
  getEtiquetasDeEntidad,
  asignarEtiqueta,
  desasignarEtiqueta,
} from "@/lib/modules/entidades/actions/etiquetas.actions";
import { createDriveFolder } from "@/lib/services/driveMock.service";
import { materializeBlueprintCarpetas } from "@/lib/modules/entidades/actions/boveda.actions";
import { TabBoveda } from "./TabBoveda";

// ─── 5 cajones SALI — estructura rigida, no ampliable ───────────────────────

const CAJONES_VALIDOS = new Set(["Identidad", "Departamento", "Servicio", "Estado", "Inteligencia"]);

// Orden visual: constructores (carpetas) primero, luego atributos
const ORDEN_VISUAL: Record<string, number> = {
  "Departamento": 1,
  "Servicio":     2,
  "Identidad":    3,
  "Estado":       4,
  "Inteligencia": 5,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EtiquetaOption {
  id:              string;
  nombre:          string;
  color:           string;
  es_sistema:      boolean;
  scope:           string;
  parent_id?:      string | null;
  parent?:         { id: string; nombre: string } | null;
  es_expediente?:  boolean;
  categoria:       { id: string; nombre: string };
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
    blueprint: string[] | null;
    categoria: { id: string; nombre: string };
  };
}

interface DropPayload {
  id:              string;
  nombre:          string;
  color:           string;
  categoriaNombre: string;
  categoriaTipo:   "CONSTRUCTOR" | "ATRIBUTO";
  parentId?:       string | null;
  parentNombre?:   string | null;
  esExpediente?:   boolean;
}

interface CommandCenterProps {
  contactoId:   string;
  contactoName: string;
  children:     ReactNode;
}

// ─── Context para compartir tags asignados con componentes hijos ─────────────

const AssignedTagsContext = createContext<AssignedTag[]>([]);
const ClassificationToggleContext = createContext<{
  open: boolean;
  toggle: () => void;
  accentColor: string;
}>({ open: false, toggle: () => {}, accentColor: "#f97316" });

/**
 * Tira vertical de etiquetas asignadas — se coloca dentro de la identity card
 * en page.tsx (RSC). Lee los tags desde el contexto de CommandCenter.
 */
export function AssignedTagsStrip() {
  const assigned = useContext(AssignedTagsContext);
  const { tenant } = useTenant();

  // Solo atributos — los constructores se ven en el simulador de Drive
  const atributos = assigned.filter((a) => getCategoriaTipo(a.etiqueta.categoria.nombre) === "ATRIBUTO");
  if (atributos.length === 0) return null;

  return (
    <div
      className="flex-1 flex flex-wrap content-start items-start gap-1 border-l px-2 py-2 overflow-hidden"
      style={{ borderLeftColor: `${tenant.color}20`, maxHeight: "140px" }}
    >
      {atributos.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px] font-medium ring-1 ring-inset whitespace-nowrap"
          style={{ backgroundColor: `${a.etiqueta.color}10`, color: a.etiqueta.color }}
          title={`${a.etiqueta.nombre} (${a.etiqueta.categoria.nombre})`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: a.etiqueta.color }}
          />
          {a.etiqueta.nombre}
        </span>
      ))}
    </div>
  );
}

/**
 * Botón toggle + label para abrir/cerrar el panel de clasificación.
 * Se coloca en la identity card de page.tsx, a la derecha de las etiquetas.
 */
export function ClassificationToggle() {
  const { open, toggle, accentColor } = useContext(ClassificationToggleContext);

  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center gap-1.5 px-3 border-l"
      style={{ borderLeftColor: `${accentColor}20` }}
    >
      <button
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200 hover:scale-110"
        style={{
          borderColor: accentColor,
          color: accentColor,
          backgroundColor: `${accentColor}15`,
        }}
        title={open ? "Volver a la ficha" : "Atributos y estructura de carpetas"}
      >
        {open
          ? <ChevronRight className="h-4 w-4" />
          : <ChevronLeft className="h-4 w-4" />
        }
      </button>
      <div className="flex flex-col items-center select-none" style={{ color: `${accentColor}60` }}>
        <span className="text-[8px] font-bold uppercase tracking-widest">Atributos</span>
        <span className="text-[10px] font-light leading-none">+</span>
        <span className="text-[8px] font-bold uppercase tracking-widest">Carpetas</span>
      </div>
    </div>
  );
}

// ─── CommandCenter ────────────────────────────────────────────────────────────

export function CommandCenter({ contactoId, contactoName, children }: CommandCenterProps) {
  const { tenant, isSuperAdmin } = useTenant();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [grupos, setGrupos]                       = useState<CategoriaGroup[]>([]);
  const [assigned, setAssigned]                   = useState<AssignedTag[]>([]);
  const [isOverAtributos, setIsOverAtributos]     = useState(false);
  const [isOverCarpetas, setIsOverCarpetas]       = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [bovedaReloadKey, setBovedaReloadKey] = useState(0);

  // ── Estado del modal de Nuevo Expediente ──────────────────────────────────
  const [expedienteModal, setExpedienteModal] = useState<{
    payload: DropPayload;
  } | null>(null);
  const [expNombre, setExpNombre]     = useState("");
  const [expCodigo, setExpCodigo]     = useState("");
  const [expSaving, setExpSaving]     = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const [gRes, aRes] = await Promise.all([
        getEtiquetasByTenant(tenant.scope, isSuperAdmin),
        getEtiquetasDeEntidad(contactoId, "CONTACTO"),
      ]);
      if (gRes.ok) {
        // Server ya filtra y ordena los 5 cajones SALI.
        // Filtro redundante como defensa en profundidad.
        const all = (gRes.data as CategoriaGroup[])
          .filter((g) => CAJONES_VALIDOS.has(g.nombre))
          .sort((a, b) => (ORDEN_VISUAL[a.nombre] ?? 99) - (ORDEN_VISUAL[b.nombre] ?? 99));
        setGrupos(all);
      }
      if (aRes.ok) setAssigned(aRes.data as unknown as AssignedTag[]);
    });
  }, [tenant.scope, isSuperAdmin, contactoId]);

  const isAlreadyAssigned = useCallback(
    (etiquetaId: string) => assigned.some((a) => a.etiqueta_id === etiquetaId),
    [assigned]
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleAssign(payload: DropPayload) {
    if (isAlreadyAssigned(payload.id)) {
      toast({ message: `"${payload.nombre}" ya asignada`, variant: "warning", icon: "tag" });
      return;
    }

    // ── Interceptar etiquetas de tipo Expediente → abrir modal ──────────────
    if (payload.esExpediente) {
      setExpedienteModal({ payload });
      setExpNombre("");
      setExpCodigo(`EXP-${Date.now().toString(36).toUpperCase().slice(-6)}`);
      return;
    }

    // ── Auto-asignación de Departamento padre para Servicios ──────────────
    // Si el Servicio tiene un parentId (Departamento) y el contacto no lo tiene,
    // asignamos el Departamento padre automáticamente antes del Servicio.
    if (payload.categoriaNombre === "Servicio" && payload.parentId && !isAlreadyAssigned(payload.parentId)) {
      const parentResult = await asignarEtiqueta(payload.parentId, contactoId, "CONTACTO");
      if (parentResult.ok) {
        const parentTag: AssignedTag = {
          id:          `opt-${payload.parentId}`,
          etiqueta_id: payload.parentId,
          etiqueta: {
            id:        payload.parentId,
            nombre:    payload.parentNombre ?? "Departamento",
            color:     "#f97316",
            blueprint: null,
            categoria: { id: "Departamento", nombre: "Departamento" },
          },
        };
        setAssigned((prev) => [...prev, parentTag]);
        toast({ message: `Departamento "${payload.parentNombre}" asignado automáticamente`, variant: "info", icon: "folder" });
      }
    }

    const result = await asignarEtiqueta(payload.id, contactoId, "CONTACTO");
    if (!result.ok) { toast({ message: result.error, variant: "error" }); return; }

    // Actualización optimista — añade la etiqueta que el usuario eligió
    const optimisticTag: AssignedTag = {
      id:          `opt-${payload.id}`,
      etiqueta_id: payload.id,
      etiqueta: {
        id:        payload.id,
        nombre:    payload.nombre,
        color:     payload.color,
        blueprint: null,
        categoria: {
          id:     payload.categoriaNombre,
          nombre: payload.categoriaNombre,
        },
      },
    };
    setAssigned((prev) => [...prev, optimisticTag]);

    if (payload.categoriaTipo === "CONSTRUCTOR") {
      // Materializar carpetas blueprint en BD (reemplaza simulación)
      const matResult = await materializeBlueprintCarpetas(contactoId, payload.id);
      if (matResult.ok && matResult.data.carpetaIds.length > 0) {
        toast({ message: `Carpeta "${payload.nombre}" creada en la Bóveda`, variant: "success", icon: "folder" });
        setBovedaReloadKey((k) => k + 1);
      } else {
        // Fallback: simulación mock (carpeta ya existía o categoría no-Constructor)
        const dr = await createDriveFolder({
          contactoId, contactoName,
          categoriaNombre: payload.categoriaNombre,
          etiquetaNombre:  payload.nombre,
        });
        if (dr.success) {
          toast({ message: `[SIMULACION] Carpeta: ${dr.path}`, variant: "info", icon: "folder" });
        }
      }
    } else {
      toast({ message: `"${payload.nombre}" guardado`, variant: "success", icon: "tag" });
    }
  }

  async function handleRemove(etiquetaId: string, nombre: string) {
    const result = await desasignarEtiqueta(etiquetaId, contactoId, "CONTACTO");
    if (result.ok) {
      setAssigned((prev) => prev.filter((a) => a.etiqueta_id !== etiquetaId));
      toast({ message: `"${nombre}" desvinculada`, variant: "info", icon: "tag" });
    }
  }

  async function handlePaletteClick(e: EtiquetaOption) {
    if (isAlreadyAssigned(e.id)) return;
    await handleAssign({
      id: e.id, nombre: e.nombre, color: e.color,
      categoriaNombre: e.categoria.nombre,
      categoriaTipo: getCategoriaTipo(e.categoria.nombre),
      parentId: e.parent_id ?? null,
      parentNombre: e.parent?.nombre ?? null,
      esExpediente: e.es_expediente ?? false,
    });
  }

  function makeDragData(e: EtiquetaOption): string {
    return JSON.stringify({
      id: e.id, nombre: e.nombre, color: e.color,
      categoriaNombre: e.categoria.nombre,
      categoriaTipo: getCategoriaTipo(e.categoria.nombre),
      parentId: e.parent_id ?? null,
      parentNombre: e.parent?.nombre ?? null,
      esExpediente: e.es_expediente ?? false,
    } satisfies DropPayload);
  }

  // ─── Drop Zone handlers — dos zonas tipadas ──────────────────────────────

  function makeDropHandlers(
    zone: "ATRIBUTO" | "CONSTRUCTOR",
    setOver: (v: boolean) => void,
  ) {
    return {
      onDragOver(e: DragEvent) {
        if (isPending) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      },
      onDragLeave(e: DragEvent) {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(false);
      },
      onDrop(e: DragEvent) {
        e.preventDefault();
        setOver(false);
        if (isPending) return;
        try {
          const payload = JSON.parse(e.dataTransfer.getData("text/plain")) as DropPayload;
          if (!payload.id) return;
          // Solo acepta tags del tipo correspondiente a esta zona
          if (payload.categoriaTipo !== zone) {
            const esperado = zone === "CONSTRUCTOR" ? "Carpetas" : "Atributos";
            toast({ message: `Esta etiqueta no es de tipo ${esperado}`, variant: "warning", icon: "tag" });
            return;
          }
          handleAssign(payload);
        } catch { /* ignore */ }
      },
    };
  }

  /** Completa la asignación de etiqueta de tipo Expediente tras rellenar el modal. */
  async function completeExpedienteAssign() {
    if (!expedienteModal || !expNombre.trim() || !expCodigo.trim()) return;
    setExpSaving(true);
    try {
      // Asignar la etiqueta normalmente (sin interceptar, pues ya hemos recogido datos)
      const payload = { ...expedienteModal.payload, esExpediente: false };
      // Reutilizamos la lógica de assign pero bypass el interceptor
      await handleAssignDirect(payload);
      toast({
        message: `Expediente "${expNombre.trim()}" (${expCodigo.trim()}) creado para "${payload.nombre}"`,
        variant: "success",
        icon: "folder",
      });
    } finally {
      setExpSaving(false);
      setExpedienteModal(null);
    }
  }

  /** Asignación directa sin interceptar es_expediente (usado post-modal). */
  async function handleAssignDirect(payload: DropPayload) {
    // Auto-asignación de Departamento padre
    if (payload.categoriaNombre === "Servicio" && payload.parentId && !isAlreadyAssigned(payload.parentId)) {
      const parentResult = await asignarEtiqueta(payload.parentId, contactoId, "CONTACTO");
      if (parentResult.ok) {
        const parentTag: AssignedTag = {
          id: `opt-${payload.parentId}`, etiqueta_id: payload.parentId,
          etiqueta: { id: payload.parentId, nombre: payload.parentNombre ?? "Departamento", color: "#f97316", blueprint: null, categoria: { id: "Departamento", nombre: "Departamento" } },
        };
        setAssigned((prev) => [...prev, parentTag]);
        toast({ message: `Departamento "${payload.parentNombre}" asignado automáticamente`, variant: "info", icon: "folder" });
      }
    }
    const result = await asignarEtiqueta(payload.id, contactoId, "CONTACTO");
    if (!result.ok) { toast({ message: result.error, variant: "error" }); return; }
    const optimisticTag: AssignedTag = {
      id: `opt-${payload.id}`, etiqueta_id: payload.id,
      etiqueta: { id: payload.id, nombre: payload.nombre, color: payload.color, blueprint: null, categoria: { id: payload.categoriaNombre, nombre: payload.categoriaNombre } },
    };
    setAssigned((prev) => [...prev, optimisticTag]);
    if (payload.categoriaTipo === "CONSTRUCTOR") {
      const matResult = await materializeBlueprintCarpetas(contactoId, payload.id);
      if (matResult.ok && matResult.data.carpetaIds.length > 0) {
        toast({ message: `Carpeta "${payload.nombre}" creada en la Bóveda`, variant: "success", icon: "folder" });
        setBovedaReloadKey((k) => k + 1);
      } else {
        const dr = await createDriveFolder({ contactoId, contactoName, categoriaNombre: payload.categoriaNombre, etiquetaNombre: payload.nombre });
        if (dr.success) toast({ message: `[SIMULACION] Carpeta: ${dr.path}`, variant: "info", icon: "folder" });
      }
    } else {
      toast({ message: `"${payload.nombre}" guardado`, variant: "success", icon: "tag" });
    }
  }

  const dropAtributos = makeDropHandlers("ATRIBUTO", setIsOverAtributos);
  const dropCarpetas  = makeDropHandlers("CONSTRUCTOR", setIsOverCarpetas);

  // Group assigned by category
  const assignedByCategoria = assigned.reduce<Record<string, AssignedTag[]>>((acc, a) => {
    const cat = a.etiqueta.categoria.nombre;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const assignedConstructores = assigned.filter((a) => getCategoriaTipo(a.etiqueta.categoria.nombre) === "CONSTRUCTOR");
  const assignedAtributos     = assigned.filter((a) => getCategoriaTipo(a.etiqueta.categoria.nombre) === "ATRIBUTO");

  const accentColor = tenant.color;

  // ─── Filtrado inteligente: Departamentos asignados → resaltar Servicios hijos ──
  const assignedDeptIds = new Set(
    assigned
      .filter((a) => a.etiqueta.categoria.nombre === "Departamento")
      .map((a) => a.etiqueta_id)
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">

      {/* ══════════════════════════════════════════════════════════════════════
          COL-IZQ — Ficha del contacto — consulta
          Cuando classificationOpen=false: 100%. Cuando true: 45%.
          ══════════════════════════════════════════════════════════════════ */}
      <div
        className={`shrink-0 overflow-hidden flex transition-all duration-300 relative ${
          classificationOpen ? "w-[45%] border-r-2" : "w-full"
        }`}
        style={{ borderRightColor: classificationOpen ? `${accentColor}25` : "transparent" }}
      >
        {/* ── Contenido principal de la ficha ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Ficha — when classificationOpen, hide tab content and shrink to natural height */}
        {/* Clicking a tab also closes classification */}
        <div
          className={classificationOpen
            ? "shrink-0 [&_[data-slot=tab-content]]:hidden [&_[data-slot=tab-bar]]:opacity-40 [&_[data-slot=tab-bar]]:hover:opacity-80 [&_[data-slot=tab-bar]]:transition-opacity [&_[data-slot=tab-bar]]:cursor-pointer [&_[data-slot=tab-bar]_a]:!border-transparent [&_[data-slot=tab-bar]_a]:!text-zinc-600"
            : "flex-1 overflow-y-auto"
          }
          onClick={(e) => {
            if (!classificationOpen) return;
            const target = e.target as HTMLElement;
            if (target.closest("[data-slot=tab-bar] a")) {
              setClassificationOpen(false);
            }
          }}
        >
          <AssignedTagsContext.Provider value={assigned}>
            <ClassificationToggleContext.Provider value={{
              open: classificationOpen,
              toggle: () => setClassificationOpen((v) => !v),
              accentColor,
            }}>
              {children}
            </ClassificationToggleContext.Provider>
          </AssignedTagsContext.Provider>
        </div>

        {/* ── Gestor Documental — explorador de archivos operativo (antes Simulador) ── */}
        {classificationOpen && (
          <div className="flex-1 overflow-y-auto border-t border-zinc-800">
            <div className="px-3 py-2 border-b border-zinc-800 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FolderLock className="h-3.5 w-3.5" style={{ color: accentColor }} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Gestor Documental
                </p>
              </div>
            </div>
            <div className="px-2 py-2">
              <TabBoveda contactoId={contactoId} reloadKey={bovedaReloadKey} tenantId={tenant.id} />
            </div>
          </div>
        )}
        </div>{/* cierre contenido principal de la ficha */}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PANELES DE CLASIFICACIÓN — visibles solo cuando classificationOpen
          ══════════════════════════════════════════════════════════════════ */}
      {classificationOpen && (
      <>
      {/* COL-CENTRO — DOS DROP ZONES: Carpetas + Atributos */}
      <div
        className="w-[25%] shrink-0 flex flex-col overflow-hidden border-r-2 transition-colors duration-300"
        style={{ borderRightColor: `${accentColor}25` }}
      >
        {/* Borde superior diferenciador */}
        <div
          className="h-[3px] shrink-0"
          style={{ background: `linear-gradient(90deg, #f59e0b, ${accentColor}, #8b5cf6)` }}
        />
        {/* ── DROP CARPETAS (Constructores → Drive) ──────────────────── */}
        <div
          className="flex flex-col transition-all duration-200 border-b border-zinc-800"
          style={{ backgroundColor: isOverCarpetas ? `${accentColor}08` : "transparent" }}
          {...dropCarpetas}
        >
          <div
            className="h-[2px] shrink-0 transition-all duration-300"
            style={{
              backgroundColor: isOverCarpetas ? "#f59e0b" : "#f59e0b40",
              boxShadow: isOverCarpetas ? "0 0 8px #f59e0b50" : "none",
            }}
          />
          <div className="px-3 py-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Folder
                className="h-3.5 w-3.5 shrink-0 transition-colors duration-200"
                style={{ color: isOverCarpetas ? "#f59e0b" : "#f59e0b80" }}
              />
              <p
                className="text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200"
                style={{ color: isOverCarpetas ? "#f59e0b" : "#f59e0b80" }}
              >
                {isOverCarpetas ? "Suelta para crear carpeta" : "Carpetas"}
              </p>
              {isPending && <Zap className="h-3 w-3 text-zinc-600 animate-pulse ml-auto" />}
            </div>
          </div>
          {/* Constructor tags asignados */}
          <div className="px-3 pb-2">
            {assignedConstructores.length === 0 ? (
              <div
                className="rounded-md border border-dashed py-3 text-center transition-colors duration-200"
                style={{ borderColor: isOverCarpetas ? "#f59e0b" : "#f59e0b20" }}
              >
                <p className="text-[9px] text-zinc-700">
                  Arrastra Departamento o Servicio
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(assignedByCategoria)
                  .filter(([catName]) => getCategoriaTipo(catName) === "CONSTRUCTOR")
                  .sort(([a], [b]) => (ORDEN_VISUAL[a] ?? 99) - (ORDEN_VISUAL[b] ?? 99))
                  .map(([catName, tags]) => (
                  <div key={catName} className="rounded-md border border-zinc-800/60 bg-zinc-900/30 p-1.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Folder className="h-2.5 w-2.5 text-amber-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{catName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset"
                          style={{ backgroundColor: `${a.etiqueta.color}15`, color: a.etiqueta.color }}
                        >
                          <Folder className="h-2 w-2" />
                          {a.etiqueta.nombre}
                          <button onClick={() => handleRemove(a.etiqueta_id, a.etiqueta.nombre)} className="opacity-40 hover:opacity-100 transition-opacity">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── DROP ATRIBUTOS (Metadatos) ─────────────────────────────── */}
        <div
          className="flex-1 flex flex-col transition-all duration-200 overflow-hidden"
          style={{ backgroundColor: isOverAtributos ? `${accentColor}08` : "transparent" }}
          {...dropAtributos}
        >
          <div
            className="h-[2px] shrink-0 transition-all duration-300"
            style={{
              backgroundColor: isOverAtributos ? "#8b5cf6" : "#8b5cf640",
              boxShadow: isOverAtributos ? "0 0 8px #8b5cf650" : "none",
            }}
          />
          <div className="px-3 py-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Tag
                className="h-3.5 w-3.5 shrink-0 transition-colors duration-200"
                style={{ color: isOverAtributos ? "#8b5cf6" : "#8b5cf680" }}
              />
              <p
                className="text-[10px] font-semibold uppercase tracking-wider transition-colors duration-200"
                style={{ color: isOverAtributos ? "#8b5cf6" : "#8b5cf680" }}
              >
                {isOverAtributos ? "Suelta para asignar" : "Atributos"}
              </p>
            </div>
          </div>
          {/* Atributo tags asignados */}
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {assignedAtributos.length === 0 ? (
              <div
                className="rounded-md border border-dashed py-3 text-center transition-colors duration-200"
                style={{ borderColor: isOverAtributos ? "#8b5cf6" : "#8b5cf620" }}
              >
                <p className="text-[9px] text-zinc-700">
                  Arrastra Identidad, Estado o Inteligencia
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(assignedByCategoria)
                  .filter(([catName]) => getCategoriaTipo(catName) === "ATRIBUTO")
                  .sort(([a], [b]) => (ORDEN_VISUAL[a] ?? 99) - (ORDEN_VISUAL[b] ?? 99))
                  .map(([catName, tags]) => (
                  <div key={catName} className="rounded-md border border-zinc-800/60 bg-zinc-900/30 p-1.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Tag className="h-2.5 w-2.5 text-violet-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{catName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset"
                          style={{ backgroundColor: `${a.etiqueta.color}15`, color: a.etiqueta.color }}
                        >
                          <Tag className="h-2 w-2" />
                          {a.etiqueta.nombre}
                          <button onClick={() => handleRemove(a.etiqueta_id, a.etiqueta.nombre)} className="opacity-40 hover:opacity-100 transition-opacity">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COL-DER (30%) — Taxonomia: 5 cajones SALI (HARD-CODED)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="w-[30%] shrink-0 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-800 shrink-0 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Taxonomia
          </p>
          <Link
            href="/admin/taxonomia"
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <Pencil className="h-2.5 w-2.5" />
            Admin
          </Link>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {grupos.map((grupo, idx) => {
            const catTipo = getCategoriaTipo(grupo.nombre);
            const IconComp = catTipo === "CONSTRUCTOR" ? Folder : Tag;
            const iconColor = catTipo === "CONSTRUCTOR" ? "#f59e0b" : "#8b5cf6";
            const prevOrden = idx > 0 ? (ORDEN_VISUAL[grupos[idx - 1]?.nombre] ?? 0) : 0;
            const currOrden = ORDEN_VISUAL[grupo.nombre] ?? 0;
            const showSeparator = prevOrden <= 2 && currOrden >= 3;
            return (
              <div key={grupo.id} className="shrink-0">
                {showSeparator && (
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="h-px flex-1 bg-zinc-700/40" />
                    <span className="text-[8px] font-medium uppercase tracking-wider text-zinc-600">Atributos</span>
                    <div className="h-px flex-1 bg-zinc-700/40" />
                  </div>
                )}
                {/* Category header — ultra-compact */}
                <div className="flex items-center gap-1 px-2 pt-1.5 pb-0">
                  <IconComp className="h-2.5 w-2.5 shrink-0" style={{ color: iconColor }} />
                  <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 flex-1">
                    {grupo.nombre}
                  </p>
                </div>
                {/* Tags — dense rows, with smart filtering for Servicios */}
                <div className="flex flex-wrap gap-x-1 gap-y-0 px-2 pb-0.5">
                  {grupo.etiquetas.map((e) => {
                    const done = isAlreadyAssigned(e.id);
                    // Smart highlight: Servicios whose parent Departamento is assigned → glow
                    const isRelatedService = grupo.nombre === "Servicio"
                      && assignedDeptIds.size > 0
                      && !!e.parent_id
                      && assignedDeptIds.has(e.parent_id);
                    // Dim unrelated services when there are assigned depts
                    const isDimmedService = grupo.nombre === "Servicio"
                      && assignedDeptIds.size > 0
                      && !isRelatedService
                      && !done;
                    return (
                      <div
                        key={e.id}
                        draggable={!done}
                        onDragStart={(ev) => {
                          ev.dataTransfer.setData("text/plain", makeDragData(e));
                          ev.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => handlePaletteClick(e)}
                        className={`flex items-center gap-1 py-[2px] text-[10px] transition-all ${
                          done
                            ? "opacity-25 cursor-default"
                            : isRelatedService
                            ? "cursor-grab hover:text-zinc-100 active:cursor-grabbing"
                            : isDimmedService
                            ? "opacity-30 cursor-grab hover:opacity-70 active:cursor-grabbing"
                            : "cursor-grab hover:text-zinc-200 active:cursor-grabbing"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full shrink-0 ${isRelatedService ? "ring-1 ring-amber-500/60" : ""}`}
                          style={{ backgroundColor: e.color }}
                        />
                        <span className={`truncate ${
                          done
                            ? "text-zinc-800 line-through"
                            : isRelatedService
                            ? "text-amber-400 font-medium"
                            : "text-zinc-500"
                        }`}>
                          {e.nombre}
                        </span>
                        {isRelatedService && e.parent && (
                          <span className="text-[7px] text-amber-500/50 font-bold uppercase">
                            {e.parent.nombre.slice(0, 3)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — Nuevo Expediente (se lanza al asignar etiqueta es_expediente)
          ══════════════════════════════════════════════════════════════════ */}
      {expedienteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!expSaving) setExpedienteModal(null); }}
          role="dialog"
          aria-modal
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(ev) => ev.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15">
                <Folder className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Nuevo Expediente</h3>
                <p className="text-[10px] text-zinc-500">
                  Servicio: <span className="font-medium" style={{ color: expedienteModal.payload.color }}>{expedienteModal.payload.nombre}</span>
                </p>
              </div>
              <button
                onClick={() => setExpedienteModal(null)}
                disabled={expSaving}
                className="ml-auto text-zinc-600 hover:text-zinc-300 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Nombre del expediente
                </label>
                <input
                  value={expNombre}
                  onChange={(ev) => setExpNombre(ev.target.value)}
                  placeholder="Ej: Herencia Garcia-Lopez 2026"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500/60"
                  autoFocus
                  onKeyDown={(ev) => { if (ev.key === "Enter" && expNombre.trim()) completeExpedienteAssign(); if (ev.key === "Escape") setExpedienteModal(null); }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Codigo unico (ID de carpeta)
                </label>
                <input
                  value={expCodigo}
                  onChange={(ev) => setExpCodigo(ev.target.value)}
                  placeholder="EXP-XXXXXX"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-600 outline-none focus:border-cyan-500/60"
                />
                <p className="mt-1 text-[9px] text-zinc-600">
                  Se usara como nombre de la carpeta raiz en Drive
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Vista previa de carpeta</p>
              <div className="text-[10px] text-zinc-500 font-mono space-y-0.5">
                <div className="flex items-center gap-1">
                  <Folder className="h-2.5 w-2.5 text-amber-500" />
                  <span>{contactoName}/</span>
                </div>
                <div className="flex items-center gap-1 pl-3">
                  <Folder className="h-2.5 w-2.5 text-cyan-500" />
                  <span className="text-cyan-400">{expCodigo.trim() || "EXP-..."} — {expNombre.trim() || "..."}/</span>
                </div>
                <div className="flex items-center gap-1 pl-6">
                  <Folder className="h-2.5 w-2.5 text-zinc-700" />
                  <span className="text-zinc-600 italic">subcarpetas del servicio...</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setExpedienteModal(null)}
                disabled={expSaving}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={completeExpedienteAssign}
                disabled={!expNombre.trim() || !expCodigo.trim() || expSaving}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {expSaving ? "Creando..." : "Crear expediente y asignar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

