"use client";

// ============================================================================
// app/contactos/_modules/ficha/TabEcosistema.tsx — Pestaña Ecosistema
//
// @role: @Frontend-UX / @Data-Architect
// @spec: FASE 13.02 — Refactor UX Ecosistema
//
// CRUD completo de Relaciones: crear, editar inline, eliminar con confirmación.
// Selector de sede vinculada (direcciones del contacto destino).
// Navegación segura: link al contacto relacionado en nueva pestaña.
// ============================================================================

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  X,
  Check,
  Users,
  Building2,
  User,
  Briefcase,
  MapPin,
  ExternalLink,
  Archive,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QuickCreateModal } from "@/app/contactos/_modules/shared/QuickCreateModal";
import { DireccionFormModal } from "@/app/contactos/_modules/ficha/DireccionFormModal";
import {
  getRelacionesDeContacto,
  getRelacionesArchivadas,
  getTiposRelacionByScope,
  createRelacion,
  updateRelacion,
  deleteRelacion,
  archiveRelacion,
  restoreRelacion,
  searchContactosForPicker,
  getDireccionesForPicker,
  type ContactoPickerItem,
  type DireccionPickerItem,
} from "@/lib/modules/entidades/actions/relaciones.actions";
import { useTenant } from "@/lib/context/TenantContext";
import { getEvidenciasDeRelacion } from "@/lib/modules/entidades/actions/evidencias.actions";
import dynamic from "next/dynamic";
import { EvidenciasDropzone, EvidenciasBadge, type EvidenciaItem } from "./EvidenciasDropzone";
import { buildEgoGraph } from "@/lib/modules/entidades/utils/egoGraph";
import type { RelacionCompleta } from "@/lib/modules/entidades/repositories/relacion.repository";
import type { TipoRelacion } from "@prisma/client";

// VETO P3: lazy load del componente de grafo (sin SSR)
const EcosistemaGraphViewer = dynamic(
  () => import("./EcosistemaGraphViewer").then((m) => ({ default: m.EcosistemaGraphViewer })),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-16 text-xs text-zinc-600">Cargando grafo…</div> }
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getContactoName(c: { nombre: string | null; apellido1: string | null; razon_social: string | null; tipo: string }) {
  if (c.tipo === "PERSONA_JURIDICA") return c.razon_social ?? "—";
  return [c.nombre, c.apellido1].filter(Boolean).join(" ") || "—";
}

/** Detecta si un TipoRelacion implica participación societaria (porcentaje relevante). */
const SOCIETARIO_KEYWORDS = ["socio", "sociedad", "participada", "accionista", "participación"];
function esTipoSocietario(nombre: string): boolean {
  const lower = nombre.toLowerCase();
  return SOCIETARIO_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TabEcosistema({ contactoId, contactoName = "—", contactoTipo = "PERSONA_FISICA" }: { contactoId: string; contactoName?: string; contactoTipo?: string }) {
  const { tenant } = useTenant();
  const [relaciones, setRelaciones] = useState<RelacionCompleta[]>([]);
  const [archived, setArchived]     = useState<RelacionCompleta[]>([]);
  const [tipos, setTipos]           = useState<TipoRelacion[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [showForm, setShowForm]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Edit state ──────────────────────────────────────────────────────────
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editCargo, setEditCargo]         = useState("");
  const [editDepto, setEditDepto]         = useState("");
  const [editNotas, setEditNotas]         = useState("");
  const [editSedeId, setEditSedeId]       = useState("");
  const [editSedes, setEditSedes]         = useState<DireccionPickerItem[]>([]);
  const [editOtherId, setEditOtherId]     = useState("");
  const [showEditDireccionModal, setShowEditDireccionModal] = useState(false);
  const [editEvidencias, setEditEvidencias] = useState<EvidenciaItem[]>([]);
  const [editPorcentaje, setEditPorcentaje] = useState<string>("");

  // ── Evidencias count cache (for badges on cards) ──────────────────────
  const [evidenciaCounts, setEvidenciaCounts] = useState<Record<string, number>>({});

  // ── Ficha preview (floating modal with iframe) ──────────────────────────
  const [fichaPreview, setFichaPreview] = useState<{ id: string; nombre: string } | null>(null);

  // ── Delete/Archive confirmation ──────────────────────────────────────────
  const [deleteModal, setDeleteModal] = useState<{ id: string; nombre: string; evCount: number } | null>(null);
  const [archiveMotivo, setArchiveMotivo] = useState("");
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);

  // ── Graph modal ────────────────────────────────────────────────────────
  const [showGraph, setShowGraph] = useState(false);
  const graphDialogRef = useRef<HTMLDialogElement>(null);

  // ── Archived section toggle ──────────────────────────────────────────────
  const [showArchived, setShowArchived] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(() => {
    startTransition(async () => {
      const [relResult, archResult, tiposResult] = await Promise.all([
        getRelacionesDeContacto(contactoId),
        getRelacionesArchivadas(contactoId),
        getTiposRelacionByScope(tenant.scope),
      ]);
      if (relResult.ok) {
        setRelaciones(relResult.data);
        // Load evidencia counts for badges
        const counts: Record<string, number> = {};
        await Promise.all(
          relResult.data.map(async (rel) => {
            const evRes = await getEvidenciasDeRelacion(rel.id);
            counts[rel.id] = evRes.ok ? evRes.data.length : 0;
          })
        );
        setEvidenciaCounts(counts);
      }
      if (archResult.ok) setArchived(archResult.data);
      if (tiposResult.ok) setTipos(tiposResult.data);
    });
  }, [contactoId, tenant.scope]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Edit handlers ──────────────────────────────────────────────────────
  function startEdit(rel: RelacionCompleta) {
    setEditingId(rel.id);
    setEditCargo(rel.cargo ?? "");
    setEditDepto(rel.departamento_interno ?? "");
    setEditNotas(rel.notas ?? "");
    setEditSedeId(rel.sede_vinculada_id ?? "");
    setEditPorcentaje(rel.porcentaje != null ? String(rel.porcentaje) : "");
    setShowEditDireccionModal(false);
    // Load sedes for the "other" contact
    const isOrigin = rel.origen_id === contactoId;
    const otherId = isOrigin ? rel.destino_id : rel.origen_id;
    setEditOtherId(otherId);
    getDireccionesForPicker(otherId).then((res) => {
      if (res.ok) setEditSedes(res.data);
      else setEditSedes([]);
    });
    // Load evidencias for this relation
    getEvidenciasDeRelacion(rel.id).then((res) => {
      if (res.ok) setEditEvidencias(res.data as EvidenciaItem[]);
      else setEditEvidencias([]);
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSedes([]);
  }

  function handleUpdate(relId: string) {
    const pctValue = editPorcentaje.trim() ? parseFloat(editPorcentaje) : null;
    if (pctValue !== null && (isNaN(pctValue) || pctValue < 0 || pctValue > 100)) {
      setError("El porcentaje debe estar entre 0 y 100");
      return;
    }
    startTransition(async () => {
      const res = await updateRelacion(relId, contactoId, {
        cargo: editCargo || null,
        departamento_interno: editDepto || null,
        notas: editNotas || null,
        sede_vinculada_id: editSedeId || null,
        porcentaje: pctValue,
      });
      if (res.ok) {
        cancelEdit();
        loadData();
      } else {
        setError(res.error);
      }
    });
  }

  // ── Archive handler (soft-delete) ─────────────────────────────────────────
  function handleArchiveConfirm() {
    if (!deleteModal) return;
    const motivo = archiveMotivo.trim();
    if (!motivo) {
      setError("Debes indicar un motivo para archivar la relación");
      return;
    }
    startTransition(async () => {
      const res = await archiveRelacion(deleteModal.id, contactoId, motivo);
      if (res.ok) {
        loadData();
      } else {
        setError(res.error);
      }
      setDeleteModal(null);
      setArchiveMotivo("");
    });
  }

  // ── Delete handler (hard-delete) ────────────────────────────────────────
  function handleDeleteConfirm() {
    if (!deleteModal) return;
    startTransition(async () => {
      const res = await deleteRelacion(deleteModal.id, contactoId);
      if (res.ok) {
        setRelaciones((prev) => prev.filter((r) => r.id !== deleteModal.id));
      } else {
        setError(res.error);
      }
      setDeleteModal(null);
      setArchiveMotivo("");
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          <h3 className="text-xs font-semibold text-zinc-300">
            Ecosistema · {relaciones.length} relacion{relaciones.length !== 1 ? "es" : ""}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Abrir grafo en ventana emergente */}
          {relaciones.length > 0 && (
            <button
              onClick={() => {
                setShowGraph(true);
                setTimeout(() => graphDialogRef.current?.showModal(), 0);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              title="Abrir visor gráfico de relaciones"
            >
              <Users className="h-3 w-3" />
              Grafo
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showForm ? "Cancelar" : "Nueva relación"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-800/40 bg-red-950/20 px-3 py-2 text-[11px] text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <CreateRelacionForm
          contactoId={contactoId}
          tipos={tipos}
          onCreated={() => { setShowForm(false); loadData(); }}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* ── Graph dialog (ventana emergente redimensionable) ──────────── */}
      {showGraph && (
        <dialog
          ref={graphDialogRef}
          onClose={() => setShowGraph(false)}
          onClick={(e) => { if (e.target === e.currentTarget) { graphDialogRef.current?.close(); setShowGraph(false); } }}
          className="m-auto rounded-2xl border border-zinc-200 bg-white/95 p-0 shadow-xl backdrop-blur-sm backdrop:bg-black/30 backdrop:backdrop-blur-sm"
          style={{ width: "80vw", height: "70vh", maxWidth: "1200px", maxHeight: "800px", resize: "both", overflow: "hidden", minWidth: "500px", minHeight: "400px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-800">
                Ecosistema de {contactoName}
              </h2>
              <span className="text-[11px] text-zinc-400">
                {relaciones.length} relacion{relaciones.length !== 1 ? "es" : ""}
              </span>
            </div>
            <button
              onClick={() => { graphDialogRef.current?.close(); setShowGraph(false); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Graph content — fills remaining space */}
          <div className="h-[calc(100%-48px)] w-full">
            {(() => {
              const graph = buildEgoGraph(contactoId, contactoName, relaciones);
              return (
                <EcosistemaGraphViewer
                  nodes={graph.nodes}
                  edges={graph.edges}
                  onNodeClick={(nodeId) => {
                    const rel = relaciones.find((r) => r.origen_id === nodeId || r.destino_id === nodeId);
                    const other = rel
                      ? (rel.origen_id === nodeId ? rel.origen : rel.destino)
                      : null;
                    const nombre = other ? getContactoName(other) : "—";
                    setFichaPreview({ id: nodeId, nombre });
                  }}
                  onCenterClick={() => { graphDialogRef.current?.close(); setShowGraph(false); }}
                />
              );
            })()}
          </div>
        </dialog>
      )}

      {/* List */}
      {relaciones.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 py-10 text-center">
          <Users className="h-6 w-6 text-zinc-700" />
          <p className="mt-2 text-xs text-zinc-600">Sin relaciones registradas</p>
          <p className="text-[10px] text-zinc-700">
            Crea una relación para vincular este contacto con otro.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {relaciones.map((rel) => {
            const isOrigin = rel.origen_id === contactoId;
            const other    = isOrigin ? rel.destino : rel.origen;
            const otherName = getContactoName(other);
            const direction = isOrigin ? "→" : "←";
            const isEditing = editingId === rel.id;

            // ── Inline edit mode ──────────────────────────────────────────
            if (isEditing) {
              return (
                <div
                  key={rel.id}
                  className="rounded-lg border border-orange-500/40 bg-zinc-900/80 p-3 space-y-2.5"
                >
                  {/* Header: who + link to ficha */}
                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <span
                      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
                      style={{
                        backgroundColor: `${rel.tipo_relacion.color}20`,
                        color: rel.tipo_relacion.color,
                        borderColor: `${rel.tipo_relacion.color}40`,
                      }}
                    >
                      {rel.tipo_relacion.nombre}
                    </span>
                    <span className="text-zinc-600">{direction}</span>
                    {other.tipo === "PERSONA_JURIDICA"
                      ? <Building2 className="h-3 w-3 text-zinc-500" />
                      : <User className="h-3 w-3 text-zinc-500" />
                    }
                    <span className="font-medium">{otherName}</span>
                    <button
                      type="button"
                      onClick={() => setFichaPreview({ id: other.id, nombre: otherName })}
                      className="rounded p-0.5 text-zinc-600 hover:text-orange-400 transition-colors"
                      title={`Ver ficha de ${otherName}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Edit fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Cargo / Rol</label>
                      <input
                        type="text" value={editCargo} onChange={(e) => setEditCargo(e.target.value)}
                        placeholder="Ej: Director Financiero" maxLength={120}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Departamento</label>
                      <input
                        type="text" value={editDepto} onChange={(e) => setEditDepto(e.target.value)}
                        placeholder="Ej: Contabilidad" maxLength={120}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
                      />
                    </div>
                  </div>

                  {/* Porcentaje (solo tipos societarios) */}
                  {esTipoSocietario(rel.tipo_relacion.nombre) && (
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        Participación %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editPorcentaje}
                          onChange={(e) => setEditPorcentaje(e.target.value)}
                          placeholder="0.00"
                          min={0} max={100} step={0.01}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 pr-8 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
                        />
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">%</span>
                      </div>
                    </div>
                  )}

                  {/* Sede selector */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Sede vinculada</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowEditDireccionModal(true)}
                          className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
                        >
                          + Añadir dirección
                        </button>
                        <span className="text-zinc-700">·</span>
                        <button
                          type="button"
                          onClick={() => setFichaPreview({ id: other.id, nombre: otherName })}
                          className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-orange-400 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Ficha
                        </button>
                      </div>
                    </div>
                    {editSedes.length > 0 ? (
                      <select
                        value={editSedeId} onChange={(e) => setEditSedeId(e.target.value)}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500/60"
                      >
                        <option value="">Sin sede vinculada</option>
                        {editSedes.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[10px] text-zinc-600 italic">
                        Sin direcciones disponibles —{" "}
                        <button
                          type="button"
                          onClick={() => setFichaPreview({ id: other.id, nombre: otherName })}
                          className="text-orange-400 hover:text-orange-300 not-italic transition-colors"
                        >
                          abrir ficha para añadir
                        </button>
                      </p>
                    )}
                    {showEditDireccionModal && (
                      <DireccionFormModal
                        contactoId={editOtherId}
                        autoOpen
                        onClose={() => {
                          setShowEditDireccionModal(false);
                          getDireccionesForPicker(editOtherId).then((res) => {
                            if (res.ok) setEditSedes(res.data);
                            else setEditSedes([]);
                          });
                        }}
                      />
                    )}
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Notas</label>
                    <textarea
                      value={editNotas} onChange={(e) => setEditNotas(e.target.value)}
                      placeholder="Notas opcionales..." maxLength={500} rows={2}
                      className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
                    />
                  </div>

                  {/* Evidencias (documentos probatorios) */}
                  <EvidenciasDropzone
                    relacionId={rel.id}
                    contactoId={contactoId}
                    evidencias={editEvidencias}
                    onUpdate={() => {
                      getEvidenciasDeRelacion(rel.id).then((res) => {
                        if (res.ok) {
                          setEditEvidencias(res.data as EvidenciaItem[]);
                          setEvidenciaCounts((prev) => ({ ...prev, [rel.id]: res.data.length }));
                        }
                      });
                    }}
                  />

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <button onClick={cancelEdit}
                      className="rounded-md border border-zinc-700 px-3 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button onClick={() => handleUpdate(rel.id)} disabled={isLoading}
                      className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-orange-500 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3 w-3" /> Guardar
                    </button>
                  </div>
                </div>
              );
            }

            // ── Normal card view ──────────────────────────────────────────
            return (
              <div
                key={rel.id}
                className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 transition-colors hover:bg-zinc-900/70"
              >
                {/* Type badge */}
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
                  style={{
                    backgroundColor: `${rel.tipo_relacion.color}20`,
                    color: rel.tipo_relacion.color,
                    borderColor: `${rel.tipo_relacion.color}40`,
                  }}
                >
                  {rel.tipo_relacion.nombre}
                </span>

                {/* Direction + name (NOT a link — see ExternalLink button) */}
                <span className="text-[11px] text-zinc-600">{direction}</span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-zinc-200 truncate">
                  {other.tipo === "PERSONA_JURIDICA"
                    ? <Building2 className="h-3 w-3 shrink-0 text-zinc-500" />
                    : <User className="h-3 w-3 shrink-0 text-zinc-500" />
                  }
                  {otherName}
                </span>

                {/* Extended fields */}
                {rel.porcentaje != null && (
                  <span className="hidden md:inline-flex items-center rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 ring-1 ring-blue-500/20">
                    {rel.porcentaje % 1 === 0 ? rel.porcentaje.toFixed(0) : rel.porcentaje.toFixed(2)}%
                  </span>
                )}
                {rel.cargo && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-zinc-500">
                    <Briefcase className="h-2.5 w-2.5" />
                    {rel.cargo}
                  </span>
                )}
                {rel.departamento_interno && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-zinc-500">
                    <Building2 className="h-2.5 w-2.5" />
                    {rel.departamento_interno}
                  </span>
                )}
                {rel.sede_vinculada && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-emerald-500/70">
                    <MapPin className="h-2.5 w-2.5" />
                    {rel.sede_vinculada.etiqueta ?? rel.sede_vinculada.tipo} — {rel.sede_vinculada.calle}
                    {rel.sede_vinculada.ciudad ? `, ${rel.sede_vinculada.ciudad}` : ""}
                  </span>
                )}

                {/* Evidencias count badge */}
                <EvidenciasBadge count={evidenciaCounts[rel.id] ?? 0} />

                {/* Notas */}
                {rel.notas && (
                  <span className="hidden lg:block truncate text-[10px] text-zinc-600 max-w-[120px]" title={rel.notas}>
                    {rel.notas}
                  </span>
                )}

                {/* Action buttons (visible on hover) */}
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  {/* Open ficha in floating modal */}
                  <button
                    onClick={() => setFichaPreview({ id: other.id, nombre: otherName })}
                    className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-zinc-800 hover:text-orange-400 group-hover:opacity-100"
                    title={`Ver ficha de ${otherName}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => startEdit(rel)}
                    className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
                    title="Editar relación"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => setDeleteModal({ id: rel.id, nombre: `${rel.tipo_relacion.nombre} ${direction} ${otherName}`, evCount: evidenciaCounts[rel.id] ?? 0 })}
                    className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-red-950/40 hover:text-red-400 group-hover:opacity-100"
                    title="Eliminar relación"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Histórico de Relaciones (archivadas) ──────────────────────────── */}
      {archived.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-left text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-900/60"
          >
            <Archive className="h-3.5 w-3.5" />
            Histórico · {archived.length} relacion{archived.length !== 1 ? "es" : ""} archivada{archived.length !== 1 ? "s" : ""}
            <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${showArchived ? "rotate-180" : ""}`} />
          </button>

          {showArchived && (
            <div className="mt-2 space-y-1.5">
              {archived.map((rel) => {
                const isOrigin  = rel.origen_id === contactoId;
                const other     = isOrigin ? rel.destino : rel.origen;
                const otherName = getContactoName(other);
                const direction = isOrigin ? "→" : "←";

                return (
                  <div
                    key={rel.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2 opacity-60"
                  >
                    {/* Type badge (muted) */}
                    <span
                      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 opacity-50"
                      style={{
                        backgroundColor: `${rel.tipo_relacion.color}10`,
                        color: rel.tipo_relacion.color,
                        borderColor: `${rel.tipo_relacion.color}20`,
                      }}
                    >
                      {rel.tipo_relacion.nombre}
                    </span>

                    {/* Direction + name */}
                    <span className="text-[10px] text-zinc-700">{direction}</span>
                    <span className="text-xs text-zinc-500">{otherName}</span>

                    {/* Badge "Histórica" */}
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-semibold text-zinc-500 ring-1 ring-zinc-700">
                      <Archive className="h-2.5 w-2.5" />
                      Histórica
                    </span>

                    {/* Archive info */}
                    <span className="ml-auto text-[9px] text-zinc-700 tabular-nums">
                      {rel.archivada_at
                        ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(rel.archivada_at))
                        : "—"}
                    </span>

                    {/* Motivo tooltip */}
                    {rel.archivo_motivo && (
                      <span className="text-[9px] text-zinc-600 truncate max-w-[120px]" title={rel.archivo_motivo}>
                        {rel.archivo_motivo}
                      </span>
                    )}

                    {/* Restaurar */}
                    <button
                      onClick={() => {
                        startTransition(async () => {
                          const res = await restoreRelacion(rel.id, contactoId);
                          if (res.ok) loadData();
                          else setError(res.error);
                        });
                      }}
                      disabled={isLoading}
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-emerald-500 hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
                      title="Restaurar relación a estado activo"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de Archivar / Eliminar relación ────────────────────────── */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) { setDeleteModal(null); setArchiveMotivo(""); setConfirmHardDelete(false); } }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-5 pt-5 pb-2">
              <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                <Archive className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100">
                  ¿Qué deseas hacer con esta relación?
                </h3>
              </div>
              <button
                onClick={() => { setDeleteModal(null); setArchiveMotivo(""); setConfirmHardDelete(false); }}
                className="shrink-0 rounded-md p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-4 text-xs text-zinc-400 leading-relaxed space-y-3">
              <p>
                Relación: <strong className="text-zinc-200">{deleteModal.nombre}</strong>
              </p>

              {/* Warning: evidencias adjuntas */}
              {deleteModal.evCount > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-950/15 px-3 py-2">
                  <span className="text-amber-400 text-sm mt-0.5">📎</span>
                  <p className="text-[11px] text-amber-300/90">
                    Esta relación tiene <strong className="text-amber-200">{deleteModal.evCount} evidencia{deleteModal.evCount !== 1 ? "s" : ""}</strong> adjunta{deleteModal.evCount !== 1 ? "s" : ""}.
                    Al archivar, quedarán como histórico consultable. Al eliminar permanentemente, se perderán.
                  </p>
                </div>
              )}

              {/* Motivo de archivo */}
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Motivo <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={archiveMotivo}
                  onChange={(e) => setArchiveMotivo(e.target.value)}
                  placeholder="Ej: Relación societaria finalizada"
                  maxLength={200}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
                  onKeyDown={(e) => { if (e.key === "Enter" && archiveMotivo.trim()) handleArchiveConfirm(); }}
                  autoFocus
                />
              </div>

              {/* Hard delete expandable */}
              {!confirmHardDelete ? (
                <button
                  onClick={() => setConfirmHardDelete(true)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Eliminar permanentemente...
                </button>
              ) : (
                <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-red-300">
                    Borrado permanente e irreversible
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    Se eliminará la relación, sus evidencias y todo historial asociado.
                    Esta acción no se puede deshacer.
                  </p>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={isLoading}
                    className="flex items-center gap-1 rounded-md border border-red-500/40 bg-red-600/20 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-600/30 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Confirmar eliminación permanente
                  </button>
                </div>
              )}
            </div>

            {/* Footer — archivar (acción principal) */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
              <button
                onClick={() => { setDeleteModal(null); setArchiveMotivo(""); setConfirmHardDelete(false); }}
                disabled={isLoading}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleArchiveConfirm}
                disabled={isLoading || !archiveMotivo.trim()}
                className="rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {isLoading ? "Procesando..." : "Archivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ficha flotante del contacto relacionado ──────────────────────── */}
      {fichaPreview && (
        <FichaPreviewModal
          contactoId={fichaPreview.id}
          nombre={fichaPreview.nombre}
          onClose={() => {
            const previewId = fichaPreview.id;
            setFichaPreview(null);
            loadData();
            // Refresh sedes if editing a relation with this contact
            if (editingId && editOtherId === previewId) {
              getDireccionesForPicker(previewId).then((res) => {
                if (res.ok) setEditSedes(res.data);
              });
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Ficha Preview Modal (iframe flotante) ──────────────────────────────────

function FichaPreviewModal({
  contactoId,
  nombre,
  onClose,
}: {
  contactoId: string;
  nombre: string;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative flex h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">
            Ficha de {nombre}
          </h3>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content — iframe with filiación tab */}
        <div className="flex-1 overflow-hidden rounded-b-xl">
          <iframe
            src={`/contactos/${contactoId}?tab=filiacion&embed=1`}
            className="h-full w-full border-0 bg-zinc-950"
            title={`Ficha de ${nombre}`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Create Relation Form ───────────────────────────────────────────────────

function CreateRelacionForm({
  contactoId,
  tipos,
  onCreated,
  onError,
}: {
  contactoId: string;
  tipos: TipoRelacion[];
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [, startTransition] = useTransition();

  // Form state
  const [tipoRelacionId, setTipoRelacionId] = useState("");
  const [destinoId, setDestinoId]            = useState("");
  const [destinoName, setDestinoName]        = useState("");
  const [notas, setNotas]                    = useState("");
  const [cargo, setCargo]                    = useState("");
  const [departamento, setDepartamento]      = useState("");
  const [sedeVinculadaId, setSedeVinculadaId] = useState("");
  const [sedes, setSedes]                      = useState<DireccionPickerItem[]>([]);
  const [sedesLoaded, setSedesLoaded]          = useState(false);
  const [porcentaje, setPorcentaje]            = useState("");

  // Detectar si el tipo seleccionado es societario
  const selectedTipo = tipos.find((t) => t.id === tipoRelacionId);
  const showPorcentaje = selectedTipo ? esTipoSocietario(selectedTipo.nombre) : false;

  // Contact picker
  const [searchQuery, setSearchQuery]    = useState("");
  const [searchResults, setSearchResults] = useState<ContactoPickerItem[]>([]);
  const [showPicker, setShowPicker]      = useState(false);
  const [searchDone, setSearchDone]      = useState(false);
  const [, startSearch] = useTransition();

  // Quick create modal (embedded)
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // Direccion modal (embedded — crear dirección sin salir del formulario)
  const [showDireccionModal, setShowDireccionModal] = useState(false);

  // Reload sedes after creating a new address
  const reloadSedes = useCallback((id: string) => {
    getDireccionesForPicker(id).then((res) => {
      if (res.ok) setSedes(res.data);
      else setSedes([]);
      setSedesLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); setSearchDone(false); return; }
    setSearchDone(false);
    const timer = setTimeout(() => {
      startSearch(async () => {
        const res = await searchContactosForPicker(searchQuery, contactoId);
        if (res.ok) setSearchResults(res.data);
        setSearchDone(true);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, contactoId]);

  const selectContacto = (id: string, displayName: string) => {
    setDestinoId(id);
    setDestinoName(displayName);
    setSearchQuery("");
    setShowPicker(false);
    setSearchResults([]);
    setSedesLoaded(false);
    // Load sedes for destination contact
    getDireccionesForPicker(id).then((res) => {
      if (res.ok) setSedes(res.data);
      else setSedes([]);
      setSedesLoaded(true);
    });
  };

  // Callback from QuickCreateModal (embedded) → auto-select the new contact
  const handleQuickCreated = (contactoId: string, displayName: string) => {
    setShowQuickCreate(false);
    selectContacto(contactoId, displayName);
  };

  const handleSubmit = () => {
    if (!destinoId || !tipoRelacionId) {
      onError("Selecciona un contacto y un tipo de relación");
      return;
    }
    const pctValue = porcentaje.trim() ? parseFloat(porcentaje) : undefined;
    if (pctValue !== undefined && (isNaN(pctValue) || pctValue < 0 || pctValue > 100)) {
      onError("El porcentaje debe estar entre 0 y 100");
      return;
    }
    startTransition(async () => {
      const res = await createRelacion({
        origen_id: contactoId,
        destino_id: destinoId,
        tipo_relacion_id: tipoRelacionId,
        notas: notas || undefined,
        cargo: cargo || undefined,
        departamento_interno: departamento || undefined,
        sede_vinculada_id: sedeVinculadaId || undefined,
        porcentaje: pctValue,
      });
      if (res.ok) {
        onCreated();
      } else {
        onError(res.error);
      }
    });
  };

  // Group tipos by categoria
  const grouped = tipos.reduce<Record<string, TipoRelacion[]>>((acc, t) => {
    (acc[t.categoria] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-3 space-y-3">
      {/* Row 1: Contact picker + Type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Contact picker */}
        <div className="relative">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Contacto destino
          </label>
          {destinoId ? (
            <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200">
              <span className="truncate">{destinoName}</span>
              <button
                onClick={() => { setDestinoId(""); setDestinoName(""); setSedes([]); setSedeVinculadaId(""); setSedesLoaded(false); }}
                className="ml-auto shrink-0 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowPicker(true); }}
                  onFocus={() => setShowPicker(true)}
                  placeholder="Buscar por nombre o NIF..."
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-7 pr-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
                />
              </div>
              {showPicker && searchQuery.length >= 2 && (
                <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-xl max-h-56 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectContacto(item.id, item.displayName)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      {item.tipo === "PERSONA_JURIDICA"
                        ? <Building2 className="h-3 w-3 shrink-0 text-zinc-500" />
                        : <User className="h-3 w-3 shrink-0 text-zinc-500" />
                      }
                      <span className="truncate">{item.displayName}</span>
                      {item.fiscal_id && (
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">
                          {item.fiscal_id}
                        </span>
                      )}
                    </button>
                  ))}
                  {/* No results message */}
                  {searchDone && searchResults.length === 0 && (
                    <p className="px-3 py-2 text-[10px] text-zinc-600 italic">Sin resultados para &quot;{searchQuery}&quot;</p>
                  )}
                  {/* Quick create button — always at the bottom */}
                  {searchDone && (
                    <button
                      onClick={() => { setShowPicker(false); setShowQuickCreate(true); }}
                      className="flex w-full items-center gap-2 border-t border-zinc-800 px-3 py-2 text-left text-xs text-orange-400 hover:bg-orange-500/10 transition-colors"
                    >
                      <Plus className="h-3 w-3 shrink-0" />
                      Crear nuevo contacto: &quot;{searchQuery}&quot;
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Type selector */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Tipo de relación
          </label>
          <select
            value={tipoRelacionId}
            onChange={(e) => setTipoRelacionId(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500/60"
          >
            <option value="">Seleccionar tipo...</option>
            {Object.entries(grouped).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Extended fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Cargo / Rol
          </label>
          <input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ej: Director Financiero"
            maxLength={120}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Departamento interno
          </label>
          <input
            type="text"
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            placeholder="Ej: Contabilidad"
            maxLength={120}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
          />
        </div>
      </div>

      {/* Row 2.5: Porcentaje societario (condicional) */}
      {showPorcentaje && (
        <div className="max-w-[200px]">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Participación %
          </label>
          <div className="relative">
            <input
              type="number"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              placeholder="0.00"
              min={0} max={100} step={0.01}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 pr-8 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">%</span>
          </div>
        </div>
      )}

      {/* Row 3: Sede Vinculada */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Sede vinculada
          </label>
          {destinoId && (
            <button
              type="button"
              onClick={() => setShowDireccionModal(true)}
              className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
            >
              + Añadir dirección
            </button>
          )}
        </div>
        {!destinoId ? (
          <p className="text-[10px] text-zinc-600 italic">Selecciona un contacto destino primero</p>
        ) : !sedesLoaded ? (
          <p className="text-[10px] text-zinc-600 italic animate-pulse">Cargando direcciones...</p>
        ) : sedes.length > 0 ? (
          <select
            value={sedeVinculadaId}
            onChange={(e) => setSedeVinculadaId(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-orange-500/60"
          >
            <option value="">Sin sede vinculada</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        ) : (
          <p className="text-[10px] text-zinc-600 italic">Sin direcciones disponibles</p>
        )}
        {showDireccionModal && destinoId && (
          <DireccionFormModal
            contactoId={destinoId}
            autoOpen
            onClose={() => { setShowDireccionModal(false); reloadSedes(destinoId); }}
          />
        )}
      </div>

      {/* Row 4: Notas */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Notas
        </label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas opcionales sobre esta relación..."
          maxLength={500}
          rows={2}
          className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!destinoId || !tipoRelacionId}
          className="rounded-md bg-orange-600 px-4 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Crear relación
        </button>
      </div>

      {/* Embedded QuickCreate modal */}
      <QuickCreateModal
        externalOpen={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onCreated={handleQuickCreated}
        initialName={searchQuery}
      />
    </div>
  );
}
