// ============================================================================
// app/contactos/[id]/_components/TabFiliacionClient.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Pestaña Filiación con gestión de estado create/edit
//
// Recibe los datos de Prisma desde el RSC padre (page.tsx) y gestiona
// localmente el estado de edición de Direcciones y Canales.
// ============================================================================
"use client";

import { useState } from "react";
import { MapPin, Phone, Mail, Globe, Link2, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ContactoTipo, Prisma } from "@prisma/client";

import { DireccionFormModal } from "./DireccionFormModal";
import { CanalFormModal }     from "./CanalFormModal";
import { DireccionCardActions } from "./DireccionCardActions";
import { CanalCardActions }     from "./CanalCardActions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ContactoFull = Prisma.ContactoGetPayload<{
  include: { direcciones: true; canales: true };
}>;

type DireccionItem = ContactoFull["direcciones"][number];
type CanalItem     = ContactoFull["canales"][number];

// ─── Helpers de presentación ──────────────────────────────────────────────────

function tipoDireccionClasses(tipo: string): string {
  const map: Record<string, string> = {
    FISCAL:           "bg-blue-500/10 text-blue-400 ring-blue-500/20",
    DOMICILIO_SOCIAL: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
    WORKPLACE:        "bg-yellow-500/10 text-yellow-400 ring-yellow-500/20",
    OTRO:             "bg-zinc-700/40 text-zinc-400 ring-zinc-600/20",
  };
  return map[tipo] ?? "bg-zinc-700/40 text-zinc-400 ring-zinc-600/20";
}

function tipoDireccionLabel(tipo: string): string {
  const map: Record<string, string> = {
    FISCAL:           "Fiscal",
    DOMICILIO_SOCIAL: "Domicilio Social",
    WORKPLACE:        "Workplace / Obra",
    OTRO:             "Otro",
  };
  return map[tipo] ?? tipo;
}

function canalIcon(tipo: string): LucideIcon {
  const map: Record<string, LucideIcon> = {
    TELEFONO: Phone,
    EMAIL:    Mail,
    WEB:      Globe,
    LINKEDIN: Link2,
    WHATSAPP: Phone,
    FAX:      Phone,
  };
  return map[tipo] ?? Link2;
}

function SectionHeader({ title, actionSlot }: { title: string; actionSlot?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
      {actionSlot}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-10">
      <p className="text-xs text-zinc-600">{message}</p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TabFiliacionClient({
  contacto,
  displayName,
}: {
  contacto:    ContactoFull;
  displayName: string;
}) {
  // Null = modo creación · Non-null = modo edición con datos pre-cargados
  const [direccionEditando, setDireccionEditando] = useState<DireccionItem | null>(null);
  const [canalEditando, setCanalEditando]         = useState<CanalItem | null>(null);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Bloque 1: Identidad y Datos Base (Espejo de solo lectura) ── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Identidad y Datos Base
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Tipo</dt>
            <dd className="mt-0.5 text-sm text-zinc-300">
              {contacto.tipo === ContactoTipo.PERSONA_JURIDICA ? "Persona Jurídica" : "Persona Física"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              {contacto.tipo === ContactoTipo.PERSONA_JURIDICA ? "Razón Social" : "Nombre"}
            </dt>
            <dd className="mt-0.5 text-sm text-zinc-300">{displayName}</dd>
          </div>
          {contacto.fiscal_id && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                {contacto.fiscal_id_tipo ?? "ID Fiscal"}
              </dt>
              <dd className="mt-0.5 font-mono text-sm tracking-widest text-zinc-300">
                {contacto.fiscal_id}
              </dd>
            </div>
          )}
          {contacto.email && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Email Principal</dt>
              <dd className="mt-0.5 truncate text-sm">
                <a href={`mailto:${contacto.email}`} className="text-orange-400 transition-colors hover:text-orange-300">
                  {contacto.email}
                </a>
              </dd>
            </div>
          )}
          {contacto.telefono && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">Teléfono Principal</dt>
              <dd className="mt-0.5 font-mono text-sm text-zinc-300">
                <a href={`tel:${contacto.telefono}`} className="transition-colors hover:text-zinc-100">
                  {contacto.telefono}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── Bloque 2: Direcciones Registradas ── */}
      <section>
        <SectionHeader
          title="Direcciones Registradas"
          actionSlot={
            // key cambia al editar → remonta el modal con datos nuevos
            <DireccionFormModal
              key={direccionEditando?.id ?? "create-dir"}
              contactoId={contacto.id}
              initialData={direccionEditando ?? undefined}
              onClose={() => setDireccionEditando(null)}
            />
          }
        />
        {contacto.direcciones.length === 0 ? (
          <EmptyState message="No hay direcciones adicionales registradas." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {contacto.direcciones.map((dir) => (
              <div
                key={dir.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-zinc-500" />
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tipoDireccionClasses(dir.tipo)}`}
                    >
                      {tipoDireccionLabel(dir.tipo)}
                    </span>
                    {dir.es_principal && (
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </div>
                  {/* ── BOTÓN EDITAR: dispara setDireccionEditando ── */}
                  <DireccionCardActions
                    id={dir.id}
                    contactoId={contacto.id}
                    onEdit={() => setDireccionEditando(dir)}
                  />
                </div>
                {dir.etiqueta && (
                  <p className="mb-1 text-xs font-medium text-zinc-400">{dir.etiqueta}</p>
                )}
                <p className="text-sm font-medium text-zinc-200">{dir.calle}</p>
                {dir.calle_2 && (
                  <p className="mt-0.5 text-sm text-zinc-500">{dir.calle_2}</p>
                )}
                <p className="mt-0.5 text-xs text-zinc-500">
                  {[dir.codigo_postal, dir.ciudad, dir.provincia].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">{dir.pais}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Bloque 3: Canales de Comunicación Adicionales ── */}
      <section>
        <SectionHeader
          title="Canales de Comunicación"
          actionSlot={
            <CanalFormModal
              key={canalEditando?.id ?? "create-canal"}
              contactoId={contacto.id}
              initialData={canalEditando ?? undefined}
              onClose={() => setCanalEditando(null)}
            />
          }
        />
        {contacto.canales.length === 0 ? (
          <EmptyState message="No hay canales de comunicación adicionales registrados." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {contacto.canales.map((canal) => {
              const Icon = canalIcon(canal.tipo);
              return (
                <div
                  key={canal.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        {canal.tipo}
                      </span>
                      {canal.es_principal && (
                        <Star className="h-3.5 w-3.5 text-amber-400" />
                      )}
                    </div>
                    {/* ── BOTÓN EDITAR: dispara setCanalEditando ── */}
                    <CanalCardActions
                      id={canal.id}
                      contactoId={contacto.id}
                      onEdit={() => setCanalEditando(canal)}
                    />
                  </div>
                  <p className="break-all text-sm font-medium text-zinc-200">{canal.valor}</p>
                  {canal.etiqueta && (
                    <p className="mt-0.5 text-xs text-zinc-500">{canal.etiqueta}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
