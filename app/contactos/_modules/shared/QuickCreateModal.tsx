"use client";

// ============================================================================
// app/contactos/_modules/shared/QuickCreateModal.tsx — Alta Inteligente
//
// @role: @Frontend-UX + @UX-Strategist
// @spec: Fase 10.01 — Alta Inteligente con Radar de Adopción cross-tenant
//
// Modal simplificado: solo Nombre + Tipo (PF/PJ).
// fiscal_id_tipo se fuerza a SIN_REGISTRO, fiscal_id a null.
//
// Radar de Adopción:
//   - Búsqueda global (cross-tenant) mientras el usuario escribe
//   - Si el contacto ya existe en OTRO tenant → ofrece "Vincular" (no duplicar)
//   - Si ya existe en el tenant ACTUAL → warning de duplicado (no bloqueante)
//   - NIF enmascarado por privacidad inter-matriz (@Security-CISO)
// ============================================================================

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, X, AlertTriangle, UserPlus, Building2, User, Link2,
} from "lucide-react";
import { PFNameFields, PJRazonSocialField } from "./ContactIdentityFields";
import { useTenant, TENANTS, type TenantId } from "@/lib/context/TenantContext";
import {
  quickCreateContacto,
  searchGlobalContactos,
  vincularContactoAMatriz,
  type GlobalSearchHit,
} from "@/lib/modules/entidades/actions/contactos.actions";
import { IMPORT_ROLES } from "@/lib/modules/entidades/services/linkRole.service";

// ─── Component ──────────────────────────────────────────────────────────────

type Tipo = "PERSONA_FISICA" | "PERSONA_JURIDICA";

export interface QuickCreateModalProps {
  /** Modo embebido: controlar apertura desde fuera */
  externalOpen?: boolean;
  /** Modo embebido: callback al cerrar */
  onClose?: () => void;
  /** Modo embebido: callback al crear — recibe id y nombre del contacto recién creado */
  onCreated?: (contactoId: string, displayName: string) => void;
  /** Pre-rellenar el nombre (ej: texto del buscador que no encontró resultados) */
  initialName?: string;
}

export function QuickCreateModal({
  externalOpen,
  onClose: externalOnClose,
  onCreated,
  initialName,
}: QuickCreateModalProps = {}) {
  const isEmbedded = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEmbedded ? externalOpen : internalOpen;
  const [tipo, setTipo] = useState<Tipo>("PERSONA_FISICA");
  const [nombre, setNombre] = useState("");
  const [apellido1, setApellido1] = useState("");
  const [apellido2, setApellido2] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [globalHits, setGlobalHits] = useState<GlobalSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const { tenant } = useTenant();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Google Places (solo PJ)
  const [showCompanySearch, setShowCompanySearch] = useState(false);

  // ── Pre-fill initialName when embedded modal opens ──────────────────────
  // Split "Juan García López" → nombre="Juan", apellido1="García", apellido2="López"
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current && initialName) {
      const parts = initialName.trim().split(/\s+/);
      if (parts.length >= 3) {
        setNombre(parts[0]);
        setApellido1(parts[1]);
        setApellido2(parts.slice(2).join(" "));
      } else if (parts.length === 2) {
        setNombre(parts[0]);
        setApellido1(parts[1]);
      } else {
        setNombre(parts[0] ?? "");
      }
    }
    prevOpenRef.current = !!open;
  }, [open, initialName]);

  // ── Reset on open/close ─────────────────────────────────────────────────
  function reset() {
    setTipo("PERSONA_FISICA");
    setNombre("");
    setApellido1("");
    setApellido2("");
    setRazonSocial("");
    setRole("");
    setError(null);
    setGlobalHits([]);
    setShowCompanySearch(false);
  }

  function setOpen(v: boolean) {
    if (isEmbedded) {
      if (!v && externalOnClose) externalOnClose();
    } else {
      setInternalOpen(v);
    }
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  // ── Radar de Adopción (debounced global search) ───────────────────────
  const radarSearch = useCallback(
    (n: string, a1: string, rs: string, t: Tipo) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const query = t === "PERSONA_FISICA"
        ? [n.trim(), a1.trim()].filter(Boolean).join(" ")
        : rs.trim();

      if (query.length < 2) {
        setGlobalHits([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        const res = await searchGlobalContactos(query, tenant.id);
        if (res.ok) setGlobalHits(res.hits);
        setSearching(false);
      }, 400);
    },
    [tenant.id],
  );

  // Trigger search on name changes
  useEffect(() => {
    radarSearch(nombre, apellido1, razonSocial, tipo);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nombre, apellido1, razonSocial, tipo, radarSearch]);

  // ── Vincular contacto existente al tenant actual ──────────────────────
  function handleVincular(contactoId: string, hitName?: string) {
    setError(null);
    startTransition(async () => {
      const res = await vincularContactoAMatriz(contactoId, tenant.id, role || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (isEmbedded && onCreated) {
        onCreated(res.contactoId, hitName ?? "Contacto vinculado");
      } else {
        router.push(`/contactos/${res.contactoId}?tab=filiacion`);
      }
    });
  }

  // ── Submit (crear nuevo) ──────────────────────────────────────────────
  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await quickCreateContacto(
        {
          tipo,
          nombre:       tipo === "PERSONA_FISICA" ? nombre : null,
          apellido1:    tipo === "PERSONA_FISICA" ? apellido1 : null,
          apellido2:    tipo === "PERSONA_FISICA" ? apellido2 : null,
          razon_social: tipo === "PERSONA_JURIDICA" ? razonSocial : null,
        },
        tenant.id,
        role || null,
      );

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setOpen(false);
      if (isEmbedded && onCreated) {
        const displayName = tipo === "PERSONA_FISICA"
          ? [nombre, apellido1].filter(Boolean).join(" ") || "Nuevo contacto"
          : razonSocial || "Nuevo contacto";
        onCreated(res.contactoId, displayName);
      } else {
        router.push(`/contactos/${res.contactoId}?tab=filiacion`);
      }
    });
  }

  if (!open) {
    // In embedded mode, don't render the trigger button — the parent controls visibility
    if (isEmbedded) return null;
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
        title="Alta Rápida — crear contacto con datos mínimos"
      >
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        Alta Rápida
      </button>
    );
  }

  const isPF = tipo === "PERSONA_FISICA";

  // Separar hits: los que están en OTRO tenant (vinculables) vs los del actual (duplicados)
  const linkableHits  = globalHits.filter((h) => !h.isInCurrentTenant);
  const duplicateHits = globalHits.filter((h) => h.isInCurrentTenant);

  /** Nombre corto del tenant donde existe el contacto */
  function tenantLabel(tenantIds: string[]): string {
    return tenantIds
      .filter((id): id is TenantId => id in TENANTS)
      .map((id) => TENANTS[id].shortLabel)
      .join(", ");
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
        <div
          className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Alta Inteligente</h2>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-amber-500/20">
                Sin NIF
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-5 py-4">
            {/* Tipo selector */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipo("PERSONA_FISICA")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  isPF
                    ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                Persona Física
              </button>
              <button
                type="button"
                onClick={() => setTipo("PERSONA_JURIDICA")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  !isPF
                    ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Persona Jurídica
              </button>
            </div>

            {/* Fields — shared DRY component */}
            {isPF ? (
              <PFNameFields
                values={{ nombre, apellido1, apellido2 }}
                onChange={(field, value) => {
                  if (field === "nombre") setNombre(value);
                  else if (field === "apellido1") setApellido1(value);
                  else setApellido2(value);
                }}
                autoFocus
              />
            ) : (
              <PJRazonSocialField
                razonSocial={razonSocial}
                onRazonSocialChange={setRazonSocial}
                autoFocus
                placesVariant="button-below"
                showCompanySearch={showCompanySearch}
                onToggleCompanySearch={() => setShowCompanySearch((v) => !v)}
                placesCallbacks={{
                  onNameFill: (name) => setRazonSocial(name),
                  onAddressFill: () => {},
                  onPhoneFill: () => {},
                  onWebsiteFill: () => {},
                  onFillComplete: () => setShowCompanySearch(false),
                }}
              />
            )}

            {/* Role selector */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Rol en {tenant.shortLabel}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
              >
                <option value="">Contacto (por defecto)</option>
                {IMPORT_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* ═══ Radar de Adopción: contactos en OTRO tenant (vinculables) ═══ */}
            {linkableHits.length > 0 && (
              <div className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 dark:border-blue-800/40 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-800 dark:text-blue-400">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  Este contacto ya existe en el Holding
                </div>
                <p className="mt-1 text-[10px] text-blue-700 dark:text-blue-300/70">
                  Puedes vincularlo a {tenant.shortLabel} sin crear un duplicado.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {linkableHits.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium text-blue-900 dark:text-blue-200 truncate block">
                          {h.name}
                        </span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400/60">
                          {h.tipo === "PERSONA_FISICA" ? "PF" : "PJ"}
                          {h.maskedFiscalId ? ` · ${h.maskedFiscalId}` : " · Sin NIF"}
                          {" · "}
                          {tenantLabel(h.tenants)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleVincular(h.id, h.name)}
                        disabled={isPending}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                      >
                        <Link2 className="h-3 w-3" />
                        Vincular
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ═══ Duplicados en el tenant ACTUAL (warning, no bloqueante) ═══ */}
            {duplicateHits.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Posible duplicado{duplicateHits.length > 1 ? "s" : ""} en {tenant.shortLabel}
                </div>
                <ul className="mt-1.5 space-y-1">
                  {duplicateHits.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-900 dark:text-amber-200">{d.name}</span>
                      <span className="text-amber-700 dark:text-amber-600">
                        {d.maskedFiscalId ?? "Sin NIF"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-500/70">
                  Puedes continuar si no es un duplicado real.
                </p>
              </div>
            )}

            <p className={`text-[10px] text-zinc-600 h-4 transition-opacity ${searching ? "animate-pulse opacity-100" : "opacity-0"}`}>
              Buscando en el Holding...
            </p>

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 ring-1 ring-red-300 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800/30">
                {error}
              </p>
            )}

            {/* Info banner */}
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              El contacto se creará sin datos fiscales (SIN_REGISTRO). Podrás completar el NIF
              más adelante desde la ficha del contacto.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {isPending ? "Procesando..." : "Crear Contacto Nuevo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
