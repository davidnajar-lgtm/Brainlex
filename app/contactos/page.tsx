// ============================================================================
// app/contactos/page.tsx — Vista principal del Directorio de Contactos
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.2 — Tabla de Contactos con Empty State
// ============================================================================

import { getContactos } from "@/lib/actions/contactos.actions";
import { Contacto, ContactoStatus, ContactoTipo } from "@prisma/client";
import { DeleteButton } from "./DeleteButton";

// ─── Helpers de presentación ──────────────────────────────────────────────────

function getDisplayName(c: Contacto): string {
  if (c.tipo === ContactoTipo.PERSONA_JURIDICA) {
    return c.razon_social ?? "—";
  }
  return [c.nombre, c.apellido1, c.apellido2].filter(Boolean).join(" ") || "—";
}

function getFiscalId(c: Contacto): string {
  if (!c.fiscal_id) return "—";
  return c.fiscal_id_tipo ? `${c.fiscal_id_tipo} ${c.fiscal_id}` : c.fiscal_id;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContactoStatus }) {
  const map: Record<ContactoStatus, { label: string; className: string }> = {
    ACTIVE: {
      label: "Activo",
      className: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    },
    QUARANTINE: {
      label: "Cuarentena",
      className: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    },
    FORGOTTEN: {
      label: "Olvidado",
      className: "bg-zinc-700/40 text-zinc-500 ring-zinc-600/20",
    },
  };
  const { label, className } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${className}`}
    >
      {label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: ContactoTipo }) {
  const isPJ = tipo === ContactoTipo.PERSONA_JURIDICA;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold ${
        isPJ
          ? "bg-violet-500/10 text-violet-400"
          : "bg-blue-500/10 text-blue-400"
      }`}
    >
      {isPJ ? "PJ" : "PF"}
    </span>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
        <svg
          className="h-8 w-8 text-zinc-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.25}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>

      <h2 className="mt-5 text-base font-semibold text-zinc-200">
        El Archivo está vacío
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-zinc-500">
        Aún no hay Contactos registrados. Crea el primero para comenzar a
        gestionar clientes y contactos.
      </p>

      <a
        href="/contactos/nuevo"
        className="mt-7 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600 active:bg-orange-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Añadir Nuevo Contacto
      </a>
    </div>
  );
}

// ─── Tabla ────────────────────────────────────────────────────────────────────

function ContactosTable({ contactos }: { contactos: Contacto[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Nombre / Razón Social
            </th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              NIF / CIF
            </th>
            <th className="hidden px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:table-cell">
              Email
            </th>
            <th className="hidden px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:table-cell">
              Teléfono
            </th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Tipo
            </th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Estado
            </th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
          {contactos.map((c) => (
            <tr key={c.id} className="group transition-colors hover:bg-zinc-900/70">
              <td className="px-5 py-3.5 font-medium text-zinc-100">
                {getDisplayName(c)}
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">
                {getFiscalId(c)}
              </td>
              <td className="hidden px-5 py-3.5 text-xs text-zinc-400 md:table-cell">
                {c.email_principal ?? <span className="text-zinc-600">—</span>}
              </td>
              <td className="hidden px-5 py-3.5 font-mono text-xs text-zinc-400 md:table-cell">
                {c.telefono_movil ?? c.telefono_fijo ?? <span className="text-zinc-600">—</span>}
              </td>
              <td className="px-5 py-3.5">
                <TipoBadge tipo={c.tipo} />
              </td>
              <td className="px-5 py-3.5">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <a
                    href={`/contactos/${c.id}`}
                    title="Ver Ficha"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-orange-400"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Ver Ficha
                  </a>
                  <a
                    href={`/contactos/${c.id}/editar`}
                    className="text-xs font-medium text-zinc-500 transition-colors hover:text-orange-400"
                  >
                    Editar
                  </a>
                  <DeleteButton id={c.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-6 text-sm text-red-400">
      <span className="font-semibold">Error al cargar Contactos:</span> {message}
    </div>
  );
}

// ─── Page (RSC) ───────────────────────────────────────────────────────────────

export default async function ContactosPage() {
  const result = await getContactos();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            Directorio de Contactos
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Clientes, contactos y terceros registrados en el sistema
          </p>
        </div>

        {result.ok && result.data.length > 0 && (
          <a
            href="/contactos/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Contacto
          </a>
        )}
      </div>

      {!result.ok ? (
        <ErrorState message={result.error} />
      ) : result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <p className="text-xs text-zinc-600">
            {result.data.length} contacto{result.data.length !== 1 ? "s" : ""} registrado
            {result.data.length !== 1 ? "s" : ""}
          </p>
          <ContactosTable contactos={result.data} />
        </>
      )}
    </div>
  );
}
