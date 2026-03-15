// ============================================================================
// app/contactos/[id]/page.tsx — Command Center del Contacto
//
// @role: Agente de Frontend (React Server Component)
// @spec: Fase 4.3 — Layout 3 columnas (45/25/30), 5 cajones SALI
//
// Layout:
//   COL-IZQ (45%)    — Ficha del contacto: identidad, datos clave, mini-tabs
//   COL-CENTRO (25%) — DROP ZONE compacta + tags asignados
//   COL-DER (30%)    — Taxonomia: 5 cajones SALI (draggable)
// ============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Contact,
  Briefcase,
  ShieldCheck,
  Network,
  Phone,
  Mail,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ContactoTipo } from "@prisma/client";
import { TabFiliacionClient } from "@/app/contactos/_modules/ficha/TabFiliacionClient";
import { TabOperativa }       from "@/app/contactos/_modules/ficha/TabOperativa";
import { TabAdmin }           from "@/app/contactos/_modules/ficha/TabAdmin";
import { TabEcosistema }      from "@/app/contactos/_modules/ficha/TabEcosistema";
import { CloneStructureButton } from "@/app/contactos/_modules/ficha/CloneStructureButton";
import { IsActiveToggle }     from "@/app/contactos/_modules/ficha/IsActiveToggle";
import { RolesPanel }         from "@/app/contactos/_modules/ficha/RolesPanel";
import { DataHealthCircle }   from "@/app/contactos/_modules/shared/DataHealthCircle";
import { calcDataHealth, getMissingFields } from "@/lib/utils/dataHealth";
import { EntityActions }      from "@/app/contactos/_modules/ficha/EntityActions";
import { CommandCenter, AssignedTagsStrip, ClassificationToggle } from "@/app/contactos/_modules/ficha/CommandCenter";
import { TabBar }             from "@/app/contactos/_modules/ficha/TabBar";
import { CrossTenantBadge }   from "@/app/contactos/_modules/ficha/CrossTenantBadge";
import { TenantScopeGuard }  from "@/app/contactos/_modules/ficha/TenantScopeGuard";
import { isFiscalPending }   from "@/lib/modules/entidades/utils/fiscalPending";
import { MicroTimeline }     from "@/app/contactos/_modules/ficha/MicroTimeline";
import { contactoRepository } from "@/lib/modules/entidades/repositories/contacto.repository";

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

// ─── Tab config (compacta) ──────────────────────────────────────────────────

type TabValue = "filiacion" | "operativa" | "admin" | "ecosistema";

const TAB_META: Record<TabValue, { label: string; icon: LucideIcon; description: string }> = {
  filiacion:  { label: "Filiacion",   icon: Contact,     description: "Identidad, canales, domicilios y datos del contacto." },
  operativa:  { label: "Operativa",   icon: Briefcase,   description: "Expedientes activos y tareas pendientes." },
  admin:      { label: "Admin",       icon: ShieldCheck, description: "Ciclo de vida, auditoria y RGPD." },
  ecosistema: { label: "Ecosistema",  icon: Network,     description: "Relaciones y red de contactos." },
};

const TAB_ORDER: TabValue[] = ["filiacion", "operativa", "admin", "ecosistema"];

// ─── Tab Placeholder ────────────────────────────────────────────────────────

function TabPlaceholder({ label, description, icon: Icon }: { label: string; description: string; icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/70">
        <Icon className="h-5 w-5 text-zinc-500" />
      </div>
      <h3 className="mt-3 text-xs font-semibold text-zinc-400">{label}</h3>
      <p className="mt-1 max-w-xs text-[11px] text-zinc-600">{description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContactoFichaPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; embed?: string }>;
}) {
  const { id }  = await params;
  const { tab, embed } = await searchParams;
  const isEmbed = embed === "1";

  const contacto = await prisma.contacto.findUnique({
    where: { id },
    include: { direcciones: true, canales: true },
  });
  if (!contacto) notFound();

  const activeTab = (TAB_ORDER.includes(tab as TabValue) ? tab : "filiacion") as TabValue;
  const displayName = getDisplayName(contacto);

  // ── Embed mode: render ONLY the tab content (for iframe in FichaPreviewModal) ──
  if (isEmbed) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-950 p-4">
        {activeTab === "filiacion" ? (
          <TabFiliacionClient
            contacto={contacto}
            displayName={displayName}
            entityActionsSlot={null}
            cloneButtonSlot={null}
          />
        ) : activeTab === "operativa" ? (
          <TabOperativa contactoId={contacto.id} />
        ) : activeTab === "admin" ? (
          <TabAdmin
            contactoId={contacto.id}
            status={contacto.status}
            quarantineReason={contacto.quarantine_reason}
            quarantineExpiresAt={contacto.quarantine_expires_at}
          />
        ) : activeTab === "ecosistema" ? (
          <TabEcosistema contactoId={contacto.id} contactoName={displayName} contactoTipo={contacto.tipo} />
        ) : null}
      </div>
    );
  }

  // ── Full mode: complete Command Center layout ──────────────────────────────

  // Vínculos cross-tenant (para badge "También en LW/LX" + role per-tenant)
  const companyLinks = await prisma.contactoCompanyLink.findMany({
    where: { contacto_id: id },
    select: { company_id: true, role: true },
  });
  const linkedCompanyIds = companyLinks.map((l) => l.company_id);

  // Últimos 3 eventos del AuditLog para el micro-timeline del hero
  const recentAudit = await contactoRepository.findRecentAuditLogs(id, 3);

  const initials      = getInitials(displayName);
  const healthScore   = calcDataHealth(contacto);
  const missing       = getMissingFields(contacto);
  const healthTooltip = healthScore === 100
    ? "Ficha completa"
    : `Salud ${healthScore}% — Falta: ${missing.join(", ")}`;
  const fiscalPending = isFiscalPending(contacto.fiscal_id_tipo, contacto.fiscal_id);

  const roles = [
    contacto.es_facturadora                         ? "Matriz"      : null,
    contacto.es_cliente && !contacto.es_facturadora ? "Cliente"     : null,
    contacto.es_precliente                          ? "Pre-cliente" : null,
  ].filter(Boolean) as string[];

  // Primary address
  const addr =
    contacto.direcciones.find((d) => d.es_principal) ??
    contacto.direcciones.find((d) => d.tipo === "FISCAL") ??
    contacto.direcciones[0] ?? null;
  const addrLine2 = addr ? [addr.codigo_postal, addr.ciudad, addr.provincia].filter(Boolean).join(" ") : "";

  return (
    <div className="-m-6 flex flex-col" style={{ height: "calc(100vh - 3.5rem - 3px)" }}>
      {/* Guard: redirige al listado si el contacto no pertenece al tenant activo */}
      <TenantScopeGuard linkedCompanyIds={linkedCompanyIds} />

      {/* ── Breadcrumb bar (fixed, thin) ─────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b border-zinc-800 px-4 py-2 shrink-0">
        <Link
          href="/contactos"
          className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Contactos
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-xs text-zinc-400 font-medium truncate">{displayName}</span>
      </div>

      {/* ── Command Center (3 columnas, sin scroll global) ───────────────── */}
      <CommandCenter
        contactoId={contacto.id}
        contactoName={displayName}
      >
        {/* ════════════════════════════════════════════════════════════════
            CENTRO — Ficha del contacto (RSC)
            ════════════════════════════════════════════════════════════ */}
        <div className="h-full flex flex-col">
          {/* ── Identity card (fixed top section) ──────────────────────── */}
          <div className="flex border-b border-zinc-800 shrink-0">
            <div className="min-w-0 px-5 py-4 space-y-3">
              <div className="flex items-start gap-4">
                {/* Avatar + health + active toggle */}
                <div className="shrink-0 flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <DataHealthCircle
                      score={healthScore}
                      size={56}
                      strokeWidth={3}
                      showLabel={false}
                      className="absolute inset-0"
                      tooltip={healthTooltip}
                    />
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold text-zinc-200 m-[2px]">
                      {initials || "?"}
                    </div>
                  </div>
                  <IsActiveToggle
                    contactoId={contacto.id}
                    initialIsActive={contacto.is_active}
                  />
                </div>

                {/* Name + type + badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-semibold text-zinc-100 leading-tight truncate">
                      {displayName}
                    </h1>
                    <CrossTenantBadge linkedCompanyIds={linkedCompanyIds} />
                    {fiscalPending && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
                        title="Datos fiscales pendientes — no apto para facturación"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Sin NIF
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {contacto.tipo === ContactoTipo.PERSONA_JURIDICA ? "Persona Juridica" : "Persona Fisica"}
                    {" · "}
                    <span className="text-zinc-400 font-medium">{healthScore}%</span>
                    <span className="text-zinc-600"> completitud</span>
                  </p>

                  {/* Role badges + inline selector */}
                  <RolesPanel
                    contactoId={contacto.id}
                    initialEsCliente={contacto.es_cliente}
                    initialEsPrecliente={contacto.es_precliente}
                    initialEsFacturadora={contacto.es_facturadora}
                    companyLinks={companyLinks}
                  />
                </div>
              </div>

              {/* Contact channels — horizontal row */}
              {(contacto.telefono_movil || contacto.telefono_fijo || contacto.email_principal) && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {contacto.telefono_movil && (
                    <a href={`tel:${contacto.telefono_movil}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-300 hover:text-zinc-100 transition-colors">
                      <Phone className="h-3 w-3 text-zinc-500" />
                      {contacto.telefono_movil}
                    </a>
                  )}
                  {contacto.telefono_fijo && (
                    <a href={`tel:${contacto.telefono_fijo}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors">
                      <Phone className="h-3 w-3 text-zinc-600" />
                      {contacto.telefono_fijo}
                    </a>
                  )}
                  {contacto.email_principal && (
                    <a href={`mailto:${contacto.email_principal}`} className="inline-flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 transition-colors truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {contacto.email_principal}
                    </a>
                  )}
                </div>
              )}

              {/* Micro-timeline — resumen de actividad reciente */}
              <MicroTimeline entries={recentAudit} />

              {/* Key data row */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {contacto.fiscal_id ? (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      {contacto.fiscal_id_tipo ?? "ID Fiscal"}
                    </dt>
                    <dd className="font-mono text-[11px] text-zinc-300 tracking-wider">
                      {contacto.fiscal_id}
                    </dd>
                  </div>
                ) : fiscalPending ? (
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1.5 text-[11px] text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/20 dark:text-amber-400 dark:ring-amber-800/30">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Datos fiscales pendientes — no apto para facturación oficial
                    </div>
                  </div>
                ) : null}
                {addr && (
                  <div className="col-span-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Direccion</dt>
                    <dd className="text-[11px] text-zinc-400">
                      {addr.calle}{addrLine2 ? ` · ${addrLine2}` : ""}
                    </dd>
                  </div>
                )}
              </div>
            </div>

            {/* Tira de atributos (entre los dos separadores) */}
            <AssignedTagsStrip />

            {/* Botón toggle clasificación (separador izquierdo propio) */}
            <ClassificationToggle />
          </div>

          {/* ── Mini tab bar (con color del tenant) ──────────────────────── */}
          <TabBar
            tabs={TAB_ORDER.map((v) => ({ value: v, label: TAB_META[v].label }))}
            activeTab={activeTab}
          />

          {/* ── Tab content (scrollable area) ──────────────────────────── */}
          <div data-slot="tab-content" className="flex-1 overflow-y-auto p-4">
            {activeTab === "filiacion" ? (
              <TabFiliacionClient
                contacto={contacto}
                displayName={displayName}
                entityActionsSlot={
                  <EntityActions
                    contact={{
                      id:       contacto.id,
                      name:     displayName,
                      fiscalId: contacto.fiscal_id       ?? undefined,
                      email:    contacto.email_principal  ?? undefined,
                      phone:    contacto.telefono_movil   ?? contacto.telefono_fijo ?? undefined,
                      roles,
                      status:   contacto.status,
                    }}
                  />
                }
                cloneButtonSlot={<CloneStructureButton contactoId={contacto.id} />}
              />
            ) : activeTab === "operativa" ? (
              <TabOperativa contactoId={contacto.id} />
            ) : activeTab === "admin" ? (
              <TabAdmin
                contactoId={contacto.id}
                status={contacto.status}
                quarantineReason={contacto.quarantine_reason}
                quarantineExpiresAt={contacto.quarantine_expires_at}
              />
            ) : activeTab === "ecosistema" ? (
              <TabEcosistema contactoId={contacto.id} contactoName={displayName} contactoTipo={contacto.tipo} />
            ) : null}
          </div>
        </div>
      </CommandCenter>
    </div>
  );
}
