"use client";

// ============================================================================
// app/contactos/_modules/ficha/TabEcosistema.tsx — Pestaña Ecosistema
//
// @role: @Frontend-UX / @Data-Architect
// @spec: Consolidación Point 2 — CRUD de Relaciones entre Contactos
//
// Muestra las relaciones del contacto actual con otros contactos,
// permite crear nuevas relaciones y eliminarlas.
// ============================================================================

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Search,
  X,
  Users,
  Building2,
  User,
  Briefcase,
  MapPin,
} from "lucide-react";
import {
  getRelacionesDeContacto,
  getTiposRelacion,
  createRelacion,
  deleteRelacion,
  searchContactosForPicker,
  type ContactoPickerItem,
} from "@/lib/modules/entidades/actions/relaciones.actions";
import type { RelacionCompleta } from "@/lib/modules/entidades/repositories/relacion.repository";
import type { TipoRelacion } from "@prisma/client";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getContactoName(c: { nombre: string | null; apellido1: string | null; razon_social: string | null; tipo: string }) {
  if (c.tipo === "PERSONA_JURIDICA") return c.razon_social ?? "—";
  return [c.nombre, c.apellido1].filter(Boolean).join(" ") || "—";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TabEcosistema({ contactoId }: { contactoId: string }) {
  const [relaciones, setRelaciones] = useState<RelacionCompleta[]>([]);
  const [tipos, setTipos]           = useState<TipoRelacion[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [showForm, setShowForm]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(() => {
    startTransition(async () => {
      const [relResult, tiposResult] = await Promise.all([
        getRelacionesDeContacto(contactoId),
        getTiposRelacion(),
      ]);
      if (relResult.ok) setRelaciones(relResult.data);
      if (tiposResult.ok) setTipos(tiposResult.data);
    });
  }, [contactoId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = (relId: string) => {
    startTransition(async () => {
      const res = await deleteRelacion(relId, contactoId);
      if (res.ok) {
        setRelaciones((prev) => prev.filter((r) => r.id !== relId));
      } else {
        setError(res.error);
      }
    });
  };

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
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showForm ? "Cancelar" : "Nueva relacion"}
        </button>
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

      {/* List */}
      {relaciones.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 py-10 text-center">
          <Users className="h-6 w-6 text-zinc-700" />
          <p className="mt-2 text-xs text-zinc-600">Sin relaciones registradas</p>
          <p className="text-[10px] text-zinc-700">
            Crea una relacion para vincular este contacto con otro.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {relaciones.map((rel) => {
            const isOrigin = rel.origen_id === contactoId;
            const other    = isOrigin ? rel.destino : rel.origen;
            const otherName = getContactoName(other);
            const direction = isOrigin ? "→" : "←";

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

                {/* Direction + name */}
                <span className="text-[11px] text-zinc-600">{direction}</span>
                <Link
                  href={`/contactos/${other.id}`}
                  className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-zinc-200 hover:text-orange-400 transition-colors truncate"
                >
                  {other.tipo === "PERSONA_JURIDICA"
                    ? <Building2 className="h-3 w-3 shrink-0 text-zinc-500" />
                    : <User className="h-3 w-3 shrink-0 text-zinc-500" />
                  }
                  {otherName}
                </Link>

                {/* Extended fields */}
                {rel.cargo && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-zinc-500">
                    <Briefcase className="h-2.5 w-2.5" />
                    {rel.cargo}
                  </span>
                )}
                {rel.departamento_interno && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-zinc-500">
                    <MapPin className="h-2.5 w-2.5" />
                    {rel.departamento_interno}
                  </span>
                )}

                {/* Notas */}
                {rel.notas && (
                  <span className="hidden lg:block truncate text-[10px] text-zinc-600 max-w-[120px]" title={rel.notas}>
                    {rel.notas}
                  </span>
                )}

                <div className="ml-auto shrink-0">
                  <button
                    onClick={() => handleDelete(rel.id)}
                    className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-red-950/40 hover:text-red-400 group-hover:opacity-100"
                    title="Eliminar relacion"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
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

  // Contact picker
  const [searchQuery, setSearchQuery]    = useState("");
  const [searchResults, setSearchResults] = useState<ContactoPickerItem[]>([]);
  const [showPicker, setShowPicker]      = useState(false);
  const [, startSearch] = useTransition();

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      startSearch(async () => {
        const res = await searchContactosForPicker(searchQuery, contactoId);
        if (res.ok) setSearchResults(res.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, contactoId]);

  const selectContacto = (item: ContactoPickerItem) => {
    setDestinoId(item.id);
    setDestinoName(item.displayName);
    setSearchQuery("");
    setShowPicker(false);
    setSearchResults([]);
  };

  const handleSubmit = () => {
    if (!destinoId || !tipoRelacionId) {
      onError("Selecciona un contacto y un tipo de relacion");
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
                onClick={() => { setDestinoId(""); setDestinoName(""); }}
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
              {showPicker && searchResults.length > 0 && (
                <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-xl max-h-48 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectContacto(item)}
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Type selector */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Tipo de relacion
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

      {/* Row 3: Notas */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Notas
        </label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas opcionales sobre esta relacion..."
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
          Crear relacion
        </button>
      </div>
    </div>
  );
}
