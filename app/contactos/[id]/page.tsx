// ============================================================================
// app/contactos/[id]/page.tsx — Ficha Ampliada del Contacto
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.6 — Dashboard de Contacto (layout asimétrico 4/8)
// ============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Activity,
  Contact,
  Briefcase,
  ShieldCheck,
  Network,
  FolderLock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ContactoTipo } from "@prisma/client";
import { TabFiliacionClient }    from "./_components/TabFiliacionClient";
import { TabOperativa }          from "./_components/TabOperativa";
import { TabAdmin }              from "./_components/TabAdmin";
import { IsActiveToggle }        from "./_components/IsActiveToggle";
import { RolesPanel }            from "./_components/RolesPanel";
import { DataHealthCircle }      from "@/app/contactos/DataHealthCircle";
import { calcDataHealth }        from "@/lib/utils/dataHealth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDisplayName(contacto: {
  tipo: ContactoTipo;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  razon_social: string | null;
}): string {
  if (contacto.tipo === ContactoTipo.PERSONA_JURIDICA) {
    return contacto.razon_social ?? "—";
  }
  return (
    [contacto.nombre, contacto.apellido1, contacto.apellido2]
      .filter(Boolean)
      .join(" ") || "—"
  );
}

function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function TabPlaceholder({
  label,
  description,
  icon: Icon,
  locked,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  locked?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center ${
        locked
          ? "border-zinc-800/40 bg-zinc-900/20 opacity-50"
          : "border-zinc-800 bg-zinc-900/30"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          locked ? "bg-zinc-800/40" : "bg-zinc-800/70"
        }`}
      >
        <Icon className={`h-6 w-6 ${locked ? "text-zinc-700" : "text-zinc-500"}`} />
      </div>
      <h3
        className={`mt-4 text-sm font-semibold ${
          locked ? "text-zinc-600" : "text-zinc-400"
        }`}
      >
        {label}
      </h3>
      <p
        className={`mt-1.5 max-w-xs text-xs leading-relaxed ${
          locked ? "text-zinc-700" : "text-zinc-600"
        }`}
      >
        {/* i18n-ready: sustituir por t("tabs.{value}.description") */}
        {locked ? "Requiere rol Cliente para acceder a este módulo." : description}
      </p>
    </div>
  );
}

// ─── Tab config (i18n-ready: extraer labels a diccionario ES/EN/FR) ────────────

type TabValue = "vision" | "filiacion" | "operativa" | "admin" | "ecosistema" | "boveda";

const TAB_META: Record<TabValue, { label: string; description: string; icon: LucideIcon }> = {
  vision:     { label: "Visión General",           icon: Activity,    description: "Resumen ejecutivo: actividad reciente, KPIs y alertas del contacto." },
  filiacion:  { label: "Filiación y Canales",      icon: Contact,     description: "Datos de contacto, domicilios, canales de comunicación y preferencias." },
  operativa:  { label: "Operativa",                icon: Briefcase,   description: "Expedientes activos, tareas pendientes y línea de tiempo operativa." },
  admin:      { label: "Administración",           icon: ShieldCheck, description: "Ciclo de vida, historial de auditoría y cumplimiento normativo (RGPD)." },
  ecosistema: { label: "Ecosistema",               icon: Network,     description: "Relaciones, personas vinculadas, sociedades participadas y red de contactos." },
  boveda:     { label: "La Bóveda",                icon: FolderLock,  description: "Repositorio de documentos privados, certificados y archivos sensibles." },
};

const TAB_ORDER: TabValue[] = ["vision", "filiacion", "operativa", "admin", "ecosistema", "boveda"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContactoFichaPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id }  = await params;
  const { tab } = await searchParams;

  const contacto = await prisma.contacto.findUnique({
    where: { id },
    include: { direcciones: true, canales: true },
  });
  if (!contacto) notFound();

  const displayName  = getDisplayName(contacto);
  const initials     = getInitials(displayName);
  const healthScore  = calcDataHealth(contacto);

  // Pestaña activa: cualquier valor de TAB_ORDER es válido; fallback a "vision"
  const activeTab = (TAB_ORDER.includes(tab as TabValue) ? tab : "vision") as TabValue;

  // Todas las pestañas son visibles (Administración ahora incluye Compliance para todos)
  const visibleTabs = TAB_ORDER;

  return (
    <div className="space-y-5">
      {/* Cabecera: Volver + breadcrumb */}
      <div className="flex items-center gap-4">
        <Link
          href="/contactos"
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a contactos
        </Link>
        <div className="flex items-center gap-2 text-xs text-zinc-700">
          <span>/</span>
          <span className="text-zinc-500">{displayName}</span>
        </div>
      </div>

      {/* ── Layout asimétrico 4 / 8 ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">

        {/* ── Columna izquierda: Perfil (col-span-4) ── */}
        <aside className="md:col-span-4">
          <div className="sticky top-6 space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6">

            {/* Avatar + nombre + badge */}
            <div className="flex flex-col items-center text-center">
              {/* Avatar con health ring integrado */}
              <div className="relative">
                <DataHealthCircle
                  score={healthScore}
                  size={72}
                  strokeWidth={4}
                  showLabel={false}
                  className="absolute inset-0"
                />
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-xl font-bold text-zinc-200 m-[4px]">
                  {initials || "?"}
                </div>
              </div>

              <h1 className="mt-3 text-base font-semibold text-zinc-100 leading-tight">
                {displayName}
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                {contacto.tipo === ContactoTipo.PERSONA_JURIDICA ? "Persona Jurídica" : "Persona Física"}
              </p>

              {/* Badge de rol (estático) */}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {contacto.es_facturadora && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 bg-violet-500/15 text-violet-300 ring-violet-500/40">
                    MATRIZ
                  </span>
                )}
                {contacto.es_cliente && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
                    CLIENTE
                  </span>
                )}
                {!contacto.es_cliente && !contacto.es_precliente && !contacto.es_facturadora && (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 bg-zinc-700/60 text-zinc-300 ring-zinc-500/50">
                    CONTACTO
                  </span>
                )}
              </div>

              {/* Toggles de estado rápido */}
              <div className="mt-3 w-full space-y-1.5">
                <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Estado rápido
                </p>
                <div className="flex justify-center">
                  <IsActiveToggle
                    contactoId={contacto.id}
                    initialIsActive={contacto.is_active}
                  />
                </div>
                <RolesPanel
                  contactoId={contacto.id}
                  initialEsCliente={contacto.es_cliente}
                  initialEsPrecliente={contacto.es_precliente}
                  initialEsFacturadora={contacto.es_facturadora}
                />
              </div>

              {/* Health score label */}
              <p className="mt-1.5 text-[11px] text-zinc-600">
                Completitud: <span className="font-semibold text-zinc-400">{healthScore}%</span>
              </p>
            </div>

            {/* Separador */}
            <div className="border-t border-zinc-800" />

            {/* Datos de contacto */}
            <dl className="space-y-3 text-sm">
              {contacto.fiscal_id && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                    {contacto.fiscal_id_tipo ?? "ID Fiscal"}
                  </dt>
                  <dd className="mt-0.5 font-mono text-xs text-zinc-300 tracking-widest">
                    {contacto.fiscal_id}
                  </dd>
                </div>
              )}

              {contacto.email_principal && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                    Email
                  </dt>
                  <dd className="mt-0.5 truncate">
                    <a
                      href={`mailto:${contacto.email_principal}`}
                      className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      {contacto.email_principal}
                    </a>
                  </dd>
                </div>
              )}

              {contacto.telefono_movil && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                    Móvil
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:${contacto.telefono_movil}`}
                      className="font-mono text-xs text-zinc-300 hover:text-zinc-100 transition-colors"
                    >
                      {contacto.telefono_movil}
                    </a>
                  </dd>
                </div>
              )}

              {contacto.telefono_fijo && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                    Fijo
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:${contacto.telefono_fijo}`}
                      className="font-mono text-xs text-zinc-300 hover:text-zinc-100 transition-colors"
                    >
                      {contacto.telefono_fijo}
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            {/* Dirección principal */}
            {(() => {
              const addr =
                contacto.direcciones.find((d) => d.es_principal) ??
                contacto.direcciones.find((d) => d.tipo === "FISCAL") ??
                contacto.direcciones[0];
              if (!addr) return null;
              const linea2 = [addr.codigo_postal, addr.ciudad, addr.provincia]
                .filter(Boolean)
                .join(" ");
              return (
                <>
                  <div className="border-t border-zinc-800" />
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                      Dirección
                    </p>
                    <p className="text-xs leading-relaxed text-zinc-400">{addr.calle}</p>
                    {linea2 && (
                      <p className="text-xs text-zinc-500">{linea2}</p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Notas */}
            {contacto.notas && (
              <>
                <div className="border-t border-zinc-800" />
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                    Notas
                  </p>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-500">
                    {contacto.notas}
                  </p>
                </div>
              </>
            )}

            {/* Separador */}
            <div className="border-t border-zinc-800" />

            {/* Acción Editar */}
            <Link
              href={`/contactos/${id}/editar`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              <Pencil className="h-4 w-4" />
              Editar Ficha
            </Link>
          </div>
        </aside>

        {/* ── Columna derecha: Área de trabajo (col-span-8) ── */}
        <main className="md:col-span-8 space-y-4">

          {/* ── Super-Tabs: scroll horizontal en móvil ── */}
          <div className="overflow-x-auto pb-0.5">
            <nav className="flex min-w-max gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
              {visibleTabs.map((value) => {
                const { label, icon: Icon } = TAB_META[value];
                const isActive = activeTab === value;
                return (
                  <Link
                    key={value}
                    href={`?tab=${value}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-zinc-800 text-zinc-100 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {/* i18n-ready: t(`tabs.${value}.label`) */}
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ── Contenido del módulo activo ── */}
          {activeTab === "filiacion" ? (
            <TabFiliacionClient contacto={contacto} displayName={displayName} />
          ) : activeTab === "operativa" ? (
            <TabOperativa contactoId={contacto.id} />
          ) : activeTab === "admin" ? (
            <TabAdmin
              contactoId={contacto.id}
              status={contacto.status}
              quarantineReason={contacto.quarantine_reason}
              quarantineExpiresAt={contacto.quarantine_expires_at}
            />
          ) : (
            <TabPlaceholder
              label={TAB_META[activeTab].label}
              description={TAB_META[activeTab].description}
              icon={TAB_META[activeTab].icon}
            />
          )}
        </main>
      </div>
    </div>
  );
}
