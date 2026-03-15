"use client";

// ============================================================================
// app/contactos/ContactosClient.tsx — Directorio interactivo con tabs y búsqueda
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.6 — Segmentación profesional del Directorio de Contactos
//
// RENDIMIENTO: los datos se cargan UNA sola vez en el RSC padre.
// Tabs + búsqueda filtran sobre el array en memoria (<1ms). Zero DB queries.
// ============================================================================

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { Contacto, ContactoStatus, ContactoTipo } from "@prisma/client";
import { DeleteButton } from "./_modules/shared/DeleteButton";
import { Shield, Search, Archive, Eye, ArrowUp, ArrowDown } from "lucide-react";
import { DataHealthCircle } from "./_modules/shared/DataHealthCircle";
import { calcDataHealth, getMissingFields, isFiscalReady } from "@/lib/utils/dataHealth";
import { getContactos, searchInQuarantine, type QuarantineHit, type ContactoWithLinkRole } from "@/lib/modules/entidades/actions/contactos.actions";
import { resolveDisplayRole } from "@/lib/modules/entidades/services/linkRole.service";
import { ExportDropdown } from "./_modules/listado/ExportDropdown";
import { useTenant } from "@/lib/context/TenantContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = "todos" | "clientes" | "preclientes" | "contactos" | "facturadoras" | "activos" | "inactivos";

const TABS: { key: Tab; label: string }[] = [
  { key: "todos",        label: "Todos" },
  { key: "clientes",     label: "Clientes" },
  { key: "preclientes",  label: "Pre-clientes" },
  { key: "contactos",    label: "Contactos" },
  { key: "facturadoras", label: "Matrices" },
  { key: "activos",      label: "Activos" },
  { key: "inactivos",    label: "Inactivos" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayName(c: Contacto): string {
  if (c.tipo === ContactoTipo.PERSONA_JURIDICA) return c.razon_social ?? "—";
  return [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(" ") || "—";
}

function getFiscalId(c: Contacto): string {
  if (!c.fiscal_id) return "—";
  return c.fiscal_id_tipo ? `${c.fiscal_id_tipo} ${c.fiscal_id}` : c.fiscal_id;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status, isActive }: { status: ContactoStatus; isActive: boolean }) {
  if (status === ContactoStatus.ACTIVE && !isActive) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 bg-zinc-700/40 text-zinc-400 ring-zinc-600/30">
        Inactivo
      </span>
    );
  }
  const map: Record<ContactoStatus, { label: string; className: string }> = {
    ACTIVE:     { label: "Activo",     className: "bg-[var(--badge-activo-bg)] text-[var(--badge-activo-text)] ring-[var(--badge-activo-ring)]" },
    QUARANTINE: { label: "Cuarentena", className: "bg-[var(--badge-cuarentena-bg)] text-[var(--badge-cuarentena-text)] ring-[var(--badge-cuarentena-ring)]" },
    FORGOTTEN:  { label: "Olvidado",   className: "bg-zinc-700/40 text-zinc-500 ring-zinc-600/20" },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${className}`}>
      {label}
    </span>
  );
}

/** Mapa tenant_id → config visual para badge cross-tenant */
const TENANT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  LX: { label: "LX", color: "#FF8C00", bg: "#FF8C0012" },
  LW: { label: "LW", color: "#9B1B30", bg: "#9B1B3012" },
};

/** Resuelve el link.role del tenant activo desde el array completo de links. */
function getLinkRoleForTenant(links: { company_id: string; role: string | null }[] | undefined, tenantId: string): string | null {
  return links?.find((l) => l.company_id === tenantId)?.role ?? null;
}

function RoleBadges({ c, tenantId }: { c: ContactoWithLinkRole; tenantId: string }) {
  const ext = c as ContactoWithLinkRole & { es_precliente: boolean };
  const linkRole = getLinkRoleForTenant(c.company_links, tenantId);
  const role = resolveDisplayRole({
    linkRole,
    esCliente: c.es_cliente,
    esPrecliente: ext.es_precliente,
    esFacturadora: c.es_facturadora,
  });

  const badgeMap: Record<string, { label: string; className: string; icon?: boolean }> = {
    Matriz:        { label: "Matriz",      className: "bg-[var(--badge-matriz-bg)] text-[var(--badge-matriz-text)] ring-[var(--badge-matriz-ring)]", icon: true },
    Cliente:       { label: "Cliente",     className: "bg-[var(--badge-cliente-bg)] text-[var(--badge-cliente-text)] ring-[var(--badge-cliente-ring)]" },
    "Pre-cliente": { label: "Pre-cliente", className: "bg-[var(--badge-prec-bg)] text-[var(--badge-prec-text)] ring-[var(--badge-prec-ring)]" },
    Proveedor:     { label: "Proveedor",   className: "bg-purple-500/10 text-purple-400 ring-purple-500/30" },
    Contrario:     { label: "Contrario",   className: "bg-red-500/10 text-red-400 ring-red-500/30" },
    Notario:       { label: "Notario",     className: "bg-sky-500/10 text-sky-400 ring-sky-500/30" },
    Contacto:      { label: "Contacto",    className: "bg-zinc-700/60 text-zinc-300 ring-zinc-500/50" },
  };

  // Otros tenants donde este contacto también está vinculado
  const otherTenants = (c.company_links ?? [])
    .filter((l) => l.company_id !== tenantId && TENANT_BADGE[l.company_id])
    .map((l) => l.company_id);

  const badge = badgeMap[role] ?? badgeMap.Contacto;

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.className}`}>
        {badge.icon && <Shield className="h-2.5 w-2.5" />}
        {badge.label}
      </span>
    </div>
  );
}

/** Mini-badge que indica presencia en otro tenant (junto al nombre). */
function CrossTenantInlineBadge({ c, tenantId }: { c: ContactoWithLinkRole; tenantId: string }) {
  const otherTenants = (c.company_links ?? [])
    .filter((l) => l.company_id !== tenantId && TENANT_BADGE[l.company_id])
    .map((l) => l.company_id);

  if (otherTenants.length === 0) return null;

  return (
    <>
      {otherTenants.map((tid) => {
        const t = TENANT_BADGE[tid];
        return (
          <span
            key={tid}
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
            style={{ backgroundColor: t.bg, color: t.color, boxShadow: `inset 0 0 0 1px ${t.color}40` }}
            title={`También en ${t.label}`}
          >
            +{t.label}
          </span>
        );
      })}
    </>
  );
}

// ─── Tabla ────────────────────────────────────────────────────────────────────

type SortKey = "nombre" | "nif";
type SortDir = "asc" | "desc";

function SortableHeader({
  label, sortKey, currentSort, currentDir, onSort,
}: {
  label: string; sortKey: SortKey;
  currentSort: SortKey | null; currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  const Icon = active && currentDir === "desc" ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 transition-colors hover:text-zinc-300 ${active ? "text-zinc-300" : ""}`}
    >
      {label}
      <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-0"}`} />
    </button>
  );
}

function ContactosTable({ contactos, tenantId }: { contactos: ContactoWithLinkRole[]; tenantId: string }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return contactos;
    const list = [...contactos];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let va: string, vb: string;
      if (sortKey === "nombre") {
        va = getDisplayName(a).toLowerCase();
        vb = getDisplayName(b).toLowerCase();
      } else {
        va = (a.fiscal_id ?? "").toLowerCase();
        vb = (b.fiscal_id ?? "").toLowerCase();
      }
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return list;
  }, [contactos, sortKey, sortDir]);

  if (contactos.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 text-center">
        <p className="text-sm text-zinc-500">No hay contactos que coincidan con el filtro.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      {/* Cabecera */}
      <div className="grid grid-cols-[1fr_9rem_5rem_5rem_2rem_2.5rem_4.5rem] md:grid-cols-[1fr_9rem_12rem_8rem_5rem_5rem_2rem_2.5rem_4.5rem] gap-x-2 border-b border-zinc-800 bg-zinc-900 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <SortableHeader label="Nombre / Razón Social" sortKey="nombre" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortableHeader label="NIF" sortKey="nif" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <span className="hidden md:block">Email</span>
        <span className="hidden md:block">Teléfono</span>
        <span className="text-right">Rol</span>
        <span>Estado</span>
        <span className="text-center" title="Facturable: tiene NIF para facturar">Fact.</span>
        <span className="text-center" title="Completitud de ficha">%</span>
        <span />
      </div>

      {/* Filas */}
      <div className="divide-y divide-zinc-800/60 bg-zinc-950">
        {sorted.map((c) => {
          const ext        = c as ContactoWithLinkRole & { es_precliente: boolean; is_active: boolean };
          const linkRole   = getLinkRoleForTenant(c.company_links, tenantId);
          const role       = resolveDisplayRole({
            linkRole,
            esCliente: c.es_cliente,
            esPrecliente: ext.es_precliente,
            esFacturadora: c.es_facturadora,
          });
          const isInactive = !ext.is_active;
          const health     = calcDataHealth(c);
          const rowAccent  = role === "Matriz"      ? "border-l-2 border-l-indigo-500/60 bg-indigo-500/[0.025]"
                           : role === "Cliente"     ? "border-l-2 border-l-teal-500/50   bg-teal-500/[0.018]"
                           : role === "Pre-cliente" ? "border-l-2 border-l-amber-500/40  bg-amber-500/[0.015]"
                           : role === "Proveedor"   ? "border-l-2 border-l-purple-500/40 bg-purple-500/[0.015]"
                           : role === "Contrario"   ? "border-l-2 border-l-red-500/40    bg-red-500/[0.015]"
                           :                          "border-l-2 border-l-transparent";
          return (
            <div
              key={c.id}
              className={[
                "group relative cursor-pointer transition-colors hover:bg-zinc-900/70",
                rowAccent,
                isInactive ? "opacity-50 grayscale" : "",
              ].join(" ")}
            >
              {/* Stretched link */}
              <Link
                href={`/contactos/${c.id}`}
                className="absolute inset-0 z-10"
                aria-label={`Abrir ficha de ${getDisplayName(c)}`}
              />

              <div className="relative grid grid-cols-[1fr_9rem_5rem_5rem_2rem_2.5rem_4.5rem] md:grid-cols-[1fr_9rem_12rem_8rem_5rem_5rem_2rem_2.5rem_4.5rem] items-center gap-x-2 px-5 py-3.5">
                {/* Nombre + cross-tenant badge */}
                <div className="flex min-w-0 items-center gap-1.5">
                  {role === "Matriz" && (
                    <Shield className="h-3.5 w-3.5 shrink-0 text-[var(--badge-matriz-text)]" />
                  )}
                  <span className={`min-w-0 truncate text-sm font-medium ${
                    role === "Matriz"      ? "text-[var(--badge-matriz-text)] font-semibold"
                    : role === "Cliente"     ? "text-[var(--badge-cliente-text)]"
                    : role === "Pre-cliente" ? "text-[var(--badge-prec-text)]"
                    :                          "text-zinc-100"
                  }`}>
                    {getDisplayName(c)}
                  </span>
                  <CrossTenantInlineBadge c={c} tenantId={tenantId} />
                </div>

                {/* NIF */}
                <span className="font-mono text-xs text-zinc-400 whitespace-nowrap">
                  {getFiscalId(c)}
                </span>

                {/* Email */}
                <span className="hidden truncate text-xs text-zinc-400 md:block">
                  {c.email_principal ?? <span className="text-zinc-600">—</span>}
                </span>

                {/* Teléfono favorito */}
                <span className="hidden font-mono text-xs text-zinc-400 whitespace-nowrap md:block">
                  {c.telefono_movil ?? c.telefono_fijo ?? <span className="text-zinc-600">—</span>}
                </span>

                {/* Roles */}
                <RoleBadges c={c} tenantId={tenantId} />

                {/* Estado */}
                <StatusBadge status={c.status} isActive={ext.is_active} />

                {/* Facturable */}
                <div className="flex justify-center">
                  {isFiscalReady(c) ? (
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                      title="Facturable — tiene NIF"
                    />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-amber-500"
                      title="No facturable — falta NIF"
                    />
                  )}
                </div>

                {/* Health */}
                <div className="flex justify-center">
                  <DataHealthCircle
                    score={health}
                    size={24}
                    strokeWidth={3}
                    showLabel={false}
                    tooltip={health === 100
                      ? "Ficha completa"
                      : `${health}% — Falta: ${getMissingFields(c).join(", ")}`
                    }
                  />
                </div>

                {/* Acciones — z-20, por encima del stretched link */}
                <div className="relative z-20 flex items-center justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {role !== "Matriz" && <DeleteButton id={c.id} companyId={tenantId} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type ClientProps = {
  contactos: ContactoWithLinkRole[];
  initialNextCursor?: string | null;
  initialHasMore?: boolean;
};

export function ContactosClient({ contactos: initialContactos, initialNextCursor, initialHasMore }: ClientProps) {
  const { tenant, isSuperAdmin } = useTenant();
  const [tab,   setTab]   = useState<Tab>("todos");
  const [query, setQuery] = useState("");

  // ── @Scope-Guard: filtrado por tenant activo ──────────────────────────────
  // SSR carga todos los contactos (sin tenant). El cliente re-fetcha filtrado.
  const [contactos, setContactos] = useState<ContactoWithLinkRole[]>(initialContactos);
  const [showAll, setShowAll]     = useState(false); // bypass CEO
  const [isLoading, startTransition] = useTransition();

  // ── Cursor-based pagination (P2) ──────────────────────────────────────────
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [hasMore, setHasMore]       = useState(initialHasMore ?? false);
  const [loadingMore, startLoadMore] = useTransition();

  const effectiveTenantId = showAll ? null : tenant.id;

  // Re-fetch cuando cambia el tenant o el toggle "Ver Holding"
  useEffect(() => {
    startTransition(async () => {
      const result = await getContactos(effectiveTenantId);
      if (result.ok) {
        setContactos(result.data);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      }
    });
  }, [effectiveTenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar siguiente página (cursor-based)
  function loadMoreContactos() {
    if (!nextCursor || !hasMore) return;
    startLoadMore(async () => {
      const result = await getContactos(effectiveTenantId, nextCursor);
      if (result.ok) {
        setContactos((prev) => [...prev, ...result.data]);
        setNextCursor(result.nextCursor);
        setHasMore(result.hasMore);
      }
    });
  }

  // ── Visión de Rayos X: búsqueda en cuarentena ─────────────────────────────
  const [quarantineHit,  setQuarantineHit]  = useState<QuarantineHit | null>(null);
  const [, startQSearch] = useTransition();

  // Helper: resuelve el rol per-tenant de un contacto
  function getTenantRole(c: ContactoWithLinkRole): string {
    const ext = c as ContactoWithLinkRole & { es_precliente: boolean };
    const linkRole = getLinkRoleForTenant(c.company_links, tenant.id);
    return resolveDisplayRole({
      linkRole,
      esCliente: c.es_cliente,
      esPrecliente: ext.es_precliente,
      esFacturadora: c.es_facturadora,
    });
  }

  // Conteos por tab — usa rol per-tenant, NO flags globales
  const counts = useMemo(() => {
    const list = contactos as (ContactoWithLinkRole & { is_active: boolean })[];
    return {
      todos:        list.length,
      clientes:     list.filter(c => getTenantRole(c) === "Cliente").length,
      preclientes:  list.filter(c => getTenantRole(c) === "Pre-cliente").length,
      contactos:    list.filter(c => getTenantRole(c) === "Contacto").length,
      facturadoras: list.filter(c => getTenantRole(c) === "Matriz").length,
      activos:      list.filter(c =>  c.is_active).length,
      inactivos:    list.filter(c => !c.is_active).length,
    };
  }, [contactos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrado en memoria: tab + búsqueda (<1ms para < 5.000 registros)
  const filtered = useMemo(() => {
    const ext = contactos as (ContactoWithLinkRole & { es_precliente: boolean; is_active: boolean })[];
    let result: typeof ext = ext;
    switch (tab) {
      case "clientes":     result = ext.filter(c => getTenantRole(c) === "Cliente"); break;
      case "preclientes":  result = ext.filter(c => getTenantRole(c) === "Pre-cliente"); break;
      case "contactos":    result = ext.filter(c => getTenantRole(c) === "Contacto"); break;
      case "facturadoras": result = ext.filter(c => getTenantRole(c) === "Matriz"); break;
      case "activos":      result = ext.filter(c =>  c.is_active); break;
      case "inactivos":    result = ext.filter(c => !c.is_active); break;
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(c => {
        const name   = getDisplayName(c).toLowerCase();
        const fiscal = (c.fiscal_id ?? "").toLowerCase();
        const email  = (c.email_principal ?? "").toLowerCase();
        return name.includes(q) || fiscal.includes(q) || email.includes(q);
      });
    }

    return result;
  }, [contactos, tab, query]);

  // Separar Matriz per-tenant (pinned) del resto del listado
  // Filtra por link del tenant ACTIVO: company_id === tenant.id AND role === "Matriz"
  const matrizContacto = useMemo(
    () => contactos.find((c) =>
      c.company_links?.some((l) => l.company_id === tenant.id && l.role === "Matriz")
    ) ?? null,
    [contactos, tenant.id]
  );

  // Listado sin la Matriz (se muestra aparte, fijada)
  const filteredSinMatriz = useMemo(
    () => matrizContacto ? filtered.filter((c) => c.id !== matrizContacto.id) : filtered,
    [filtered, matrizContacto]
  );

  // Emails del listado filtrado — para ExportDropdown → copyEmailsToClipboard
  const emails = useMemo(
    () => filtered.map((c) => c.email_principal ?? "").filter(Boolean),
    [filtered]
  );

  // Rayos X: solo se dispara cuando no hay resultados activos y la query es útil
  useEffect(() => {
    if (filtered.length > 0 || !query.trim() || query.trim().length < 3) {
      setQuarantineHit(null);
      return;
    }
    const timer = setTimeout(() => {
      startQSearch(async () => {
        const res = await searchInQuarantine(query.trim());
        setQuarantineHit(res.ok && res.hit ? res.hit : null);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [query, filtered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* ── Barra superior: Tabs + Buscador ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        {/* Tabs / Pills */}
        <div className="flex flex-wrap gap-1">
          {TABS.map(({ key, label }) => {
            const active = tab === key;
            const count  = counts[key];
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? key === "facturadoras"
                      ? "bg-[var(--badge-matriz-bg)] text-[var(--badge-matriz-text)] ring-1 ring-[var(--badge-matriz-ring)]"
                      : key === "clientes"
                      ? "bg-[var(--badge-cliente-bg)] text-[var(--badge-cliente-text)] ring-1 ring-[var(--badge-cliente-ring)]"
                      : key === "preclientes"
                      ? "bg-[var(--badge-prec-bg)] text-[var(--badge-prec-text)] ring-1 ring-[var(--badge-prec-ring)]"
                      : key === "activos" || key === "inactivos"
                      ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30"
                      : "bg-zinc-700/60 text-zinc-300 ring-1 ring-zinc-500/50"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? "bg-white/10 text-inherit" : "bg-zinc-800 text-zinc-600"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Bypass CEO: ver todos los contactos del Holding */}
          {isSuperAdmin && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                showAll
                  ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                  : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800"
              }`}
              title={showAll ? "Mostrando todo el Holding" : `Filtrado por ${tenant.nombre}`}
            >
              <Eye className="h-3 w-3" />
              {showAll ? "Holding" : tenant.shortLabel}
            </button>
          )}

          {/* Buscador */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, NIF o email…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Contador + Acciones de exportación */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-600">
          {isLoading && <span className="mr-1 animate-pulse">Cargando…</span>}
          {filtered.length} contacto{filtered.length !== 1 ? "s" : ""}
          {query.trim() ? ` · "${query.trim()}"` : ""}
          {tab !== "todos" ? ` en ${TABS.find(t => t.key === tab)?.label}` : ""}
          {!showAll && <span className="ml-1 text-zinc-700">· {tenant.shortLabel}</span>}
        </p>
        <ExportDropdown emails={emails} count={filtered.length} contactos={filtered} />
      </div>

      {/* ── Matriz fijada — siempre visible al margen del listado ── */}
      {matrizContacto && (
        <Link
          href={`/contactos/${matrizContacto.id}`}
          className="group flex items-center gap-4 rounded-xl border-2 border-[var(--badge-matriz-ring)] bg-[var(--badge-matriz-bg)] px-5 py-3 transition-colors hover:bg-indigo-500/[0.08]"
        >
          <Shield className="h-5 w-5 shrink-0 text-[var(--badge-matriz-text)]" />
          <div className="flex flex-1 items-center gap-4 min-w-0">
            <span className="text-sm font-semibold text-[var(--badge-matriz-text)] truncate">
              {getDisplayName(matrizContacto)}
            </span>
            <span className="font-mono text-[11px] text-zinc-400 shrink-0">
              {getFiscalId(matrizContacto)}
            </span>
            {matrizContacto.email_principal && (
              <span className="hidden text-[11px] text-zinc-500 truncate md:block">
                {matrizContacto.email_principal}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--badge-matriz-bg)] text-[var(--badge-matriz-text)] ring-1 ring-[var(--badge-matriz-ring)]">
            <Shield className="h-2.5 w-2.5" />
            Matriz
          </span>
          <span className="text-[11px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
            Ver ficha →
          </span>
        </Link>
      )}

      {/* ── Banner Rayos X: resultado en cuarentena ── */}
      {quarantineHit && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-2.5 text-xs">
          <Archive className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-amber-400">
            Sin resultados activos. Encontrado en el{" "}
            <span className="font-semibold">Archivo de Cuarentena</span>:{" "}
            <span className="text-amber-200">{quarantineHit.name}</span>
            {quarantineHit.fiscal_id && (
              <span className="ml-1 text-amber-600">({quarantineHit.fiscal_id})</span>
            )}
          </span>
          <Link
            href={`/contactos/${quarantineHit.id}`}
            className="ml-auto shrink-0 font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-100"
          >
            Ver y Recuperar →
          </Link>
        </div>
      )}

      <ContactosTable contactos={filteredSinMatriz} tenantId={tenant.id} />

      {/* ── Paginación cursor-based (P2) ── */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMoreContactos}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50"
          >
            {loadingMore ? "Cargando..." : "Cargar más contactos"}
          </button>
        </div>
      )}
    </div>
  );
}
