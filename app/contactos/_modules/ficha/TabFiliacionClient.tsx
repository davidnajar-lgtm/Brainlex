// ============================================================================
// app/contactos/_modules/ficha/TabFiliacionClient.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Pestaña Filiación con gestión de estado create/edit
//
// Estructura de bloques:
//   1. Identidad y Datos Base   — tipo, nombre/razón social, ID fiscal (solo lectura)
//   2. Canales de Contacto      — campos directos de la tabla contacto con auto-labels i18n
//   3. Direcciones Registradas  — CRUD de direcciones via DireccionFormModal
//   4. Canales Adicionales      — CRUD de canales via CanalFormModal (labels i18n)
// ============================================================================
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Phone, Mail, Globe, Link2, Star,
  ExternalLink, Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ContactoTipo, Prisma } from "@prisma/client";
import { toggleFavoritePhone } from "@/lib/modules/entidades/actions/contactos.actions";

import { DireccionFormModal }  from "./DireccionFormModal";
import { CanalFormModal }      from "./CanalFormModal";
import { DireccionCardActions } from "./DireccionCardActions";
import { CanalCardActions }    from "./CanalCardActions";

import {
  getContactosLabels,
  type AppLocale,
  type ContactosLabels,
} from "@/lib/i18n/contactos";

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

function SectionHeader({
  title,
  actionSlot,
}: {
  title:       string;
  actionSlot?: React.ReactNode;
}) {
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

// ─── DirectChannelCard — tarjeta para un campo directo del contacto ───────────

function DirectChannelCard({
  icon: Icon,
  label,
  preferidoBadge,
  children,
}: {
  icon:          LucideIcon;
  label:         string;
  preferidoBadge?: string | false;
  children:      React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <dt className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
        {preferidoBadge && (
          <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
            {preferidoBadge}
          </span>
        )}
      </dt>
      <dd className="break-all text-sm font-medium text-zinc-200">{children}</dd>
    </div>
  );
}

// ─── FavoriteStarButton — estrella de favorito para canales TELEFONO ──────────

function FavoriteStarButton({
  canalId,
  contactoId,
  isFavorito,
}: {
  canalId:    string;
  contactoId: string;
  isFavorito: boolean;
}) {
  const router = useRouter();
  const [favorito, setFavorito]      = useState(isFavorito);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (favorito) return; // ya es favorito, sin acción
    startTransition(async () => {
      const result = await toggleFavoritePhone(canalId, contactoId);
      if (result.ok) {
        setFavorito(true);
        // Refrescar RSC → DataHealthCircle recalcula con el nuevo telefono_movil/fijo
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || favorito}
      title={favorito ? "Teléfono favorito" : "Marcar como favorito"}
      className={[
        "rounded p-0.5 transition-colors",
        favorito
          ? "cursor-default text-amber-400"
          : "text-zinc-600 hover:text-amber-400 disabled:opacity-40",
      ].join(" ")}
    >
      <Star className={`h-3.5 w-3.5 ${favorito ? "fill-amber-400" : ""}`} />
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TabFiliacionClient({
  contacto,
  displayName,
  locale = "es",
}: {
  contacto:    ContactoFull;
  displayName: string;
  /** Idioma de la interfaz. Preparado para next-intl; por defecto "es". */
  locale?:     AppLocale;
}) {
  const t = getContactosLabels(locale);

  const [direccionEditando, setDireccionEditando] = useState<DireccionItem | null>(null);
  const [canalEditando,     setCanalEditando]     = useState<CanalItem | null>(null);

  // ── Campos directos del contacto que forman los "Canales de Contacto" ──────
  const directChannels = buildDirectChannels(contacto, t);

  return (
    <div className="flex flex-col gap-6">

      {/* ══════════════════════════════════════════════════════════════════════
          Bloque 1 — Identidad y Datos Base (solo lectura)
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {t.sections.identidad}
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">

          {/* Tipo */}
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              {t.fields.tipo}
            </dt>
            <dd className="mt-0.5 text-sm text-zinc-300">
              {contacto.tipo === ContactoTipo.PERSONA_JURIDICA
                ? t.badges.personaJuridica
                : t.badges.personaFisica}
            </dd>
          </div>

          {/* Nombre / Razón Social */}
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              {contacto.tipo === ContactoTipo.PERSONA_JURIDICA
                ? t.fields.razonSocial
                : t.fields.nombre}
            </dt>
            <dd className="mt-0.5 text-sm text-zinc-300">{displayName}</dd>
          </div>

          {/* ID Fiscal */}
          {contacto.fiscal_id && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                {contacto.fiscal_id_tipo ?? t.fields.fiscalId}
              </dt>
              <dd className="mt-0.5 font-mono text-sm tracking-widest text-zinc-300">
                {contacto.fiscal_id}
              </dd>
            </div>
          )}

          {/* Tipo de Sociedad — solo Persona Jurídica */}
          {contacto.tipo === ContactoTipo.PERSONA_JURIDICA && contacto.tipo_sociedad && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                Tipo de sociedad
              </dt>
              <dd className="mt-0.5 text-sm text-zinc-300">{contacto.tipo_sociedad}</dd>
            </div>
          )}

        </dl>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          Bloque 2 — Canales de Contacto (campos directos del contacto)
          Auto-labels vía i18n; read-only (edición en /editar)
          ══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader title={t.sections.canalesContacto} />
        {directChannels.length === 0 ? (
          <EmptyState message={t.emptyStates.noCanalesDirectos} />
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {directChannels.map(({ key, icon, label, preferido, node }) => (
              <DirectChannelCard
                key={key}
                icon={icon}
                label={label}
                preferidoBadge={preferido ? t.badges.preferido : false}
              >
                {node}
              </DirectChannelCard>
            ))}
          </dl>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          Bloque 3 — Direcciones Registradas (CRUD)
          ══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title={t.sections.direcciones}
          actionSlot={
            <DireccionFormModal
              key={direccionEditando?.id ?? "create-dir"}
              contactoId={contacto.id}
              initialData={direccionEditando ?? undefined}
              onClose={() => setDireccionEditando(null)}
            />
          }
        />
        {contacto.direcciones.length === 0 ? (
          <EmptyState message={t.emptyStates.noDirecciones} />
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
                      {t.direccionTipo[dir.tipo] ?? dir.tipo}
                    </span>
                    {dir.es_principal && (
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </div>
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

      {/* ══════════════════════════════════════════════════════════════════════
          Bloque 4 — Canales Adicionales (CRUD · tabla canales)
          ══════════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          title={t.sections.canalesAdicionales}
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
          <EmptyState message={t.emptyStates.noCanales} />
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
                        {t.canalTipo[canal.tipo] ?? canal.tipo}
                        {canal.tipo === "TELEFONO" && canal.subtipo && (
                          <span className="ml-1 text-zinc-700">· {canal.subtipo}</span>
                        )}
                      </span>
                      {canal.tipo === "TELEFONO" ? (
                        <FavoriteStarButton
                          canalId={canal.id}
                          contactoId={contacto.id}
                          isFavorito={canal.es_favorito}
                        />
                      ) : canal.es_principal ? (
                        <Star className="h-3.5 w-3.5 text-amber-400" />
                      ) : null}
                    </div>
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

// ─── buildDirectChannels ──────────────────────────────────────────────────────
// Genera la lista de tarjetas para Bloque 2 a partir de los campos directos
// del contacto. Solo incluye campos con valor.

type DirectChannelEntry = {
  key:      string;
  icon:     LucideIcon;
  label:    string;
  preferido: boolean;
  node:     React.ReactNode;
};

function buildDirectChannels(
  contacto: ContactoFull,
  t: ContactosLabels,
): DirectChannelEntry[] {
  const entries: DirectChannelEntry[] = [];
  const pref = contacto.canal_preferido ?? "";

  if (contacto.email_principal) {
    entries.push({
      key:      "email_principal",
      icon:     Mail,
      label:    t.fields.emailPrincipal,
      preferido: pref === "EMAIL",
      node: (
        <a
          href={`mailto:${contacto.email_principal}`}
          className="text-orange-400 transition-colors hover:text-orange-300"
        >
          {contacto.email_principal}
        </a>
      ),
    });
  }

  if (contacto.telefono_movil) {
    entries.push({
      key:      "telefono_movil",
      icon:     Smartphone,
      label:    t.fields.telefonoMovil,
      preferido: pref === "MOVIL",
      node: (
        <a
          href={`tel:${contacto.telefono_movil}`}
          className="font-mono text-zinc-200 transition-colors hover:text-zinc-100"
        >
          {contacto.telefono_movil}
        </a>
      ),
    });
  }

  if (contacto.telefono_fijo) {
    entries.push({
      key:      "telefono_fijo",
      icon:     Phone,
      label:    t.fields.telefonoFijo,
      preferido: pref === "FIJO",
      node: (
        <a
          href={`tel:${contacto.telefono_fijo}`}
          className="font-mono text-zinc-200 transition-colors hover:text-zinc-100"
        >
          {contacto.telefono_fijo}
        </a>
      ),
    });
  }

  if (contacto.website_url) {
    entries.push({
      key:      "website_url",
      icon:     Globe,
      label:    t.fields.websiteUrl,
      preferido: false,
      node: (
        <span className="flex items-center gap-1">
          <a
            href={contacto.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-orange-400 transition-colors hover:text-orange-300"
          >
            {contacto.website_url.replace(/^https?:\/\//, "")}
          </a>
          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-600" />
        </span>
      ),
    });
  }

  if (contacto.linkedin_url) {
    entries.push({
      key:      "linkedin_url",
      icon:     Link2,
      label:    t.fields.linkedinUrl,
      preferido: false,
      node: (
        <span className="flex items-center gap-1">
          <a
            href={contacto.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-orange-400 transition-colors hover:text-orange-300"
          >
            {contacto.linkedin_url.replace(/^https?:\/\/(?:www\.)?linkedin\.com\/in\//, "")}
          </a>
          <ExternalLink className="h-3 w-3 shrink-0 text-zinc-600" />
        </span>
      ),
    });
  }

  return entries;
}
