// ============================================================================
// app/contactos/page.tsx — Vista principal del Directorio de Contactos
//
// @role: Agente de Frontend (React Server Component)
// @spec: Micro-Spec 2.6 — Segmentación profesional del Directorio
//
// RSC: carga los datos UNA sola vez y los pasa a ContactosClient.
// Toda la interactividad (tabs, búsqueda, badges) vive en el cliente.
// ============================================================================

import { getContactos } from "@/lib/modules/entidades/actions/contactos.actions";
import { ContactosClient } from "./ContactosClient";
import { QuickCreateModal } from "./_modules/shared/QuickCreateModal";

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
      <div className="mt-7">
        <QuickCreateModal />
      </div>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border p-6 text-sm"
      style={{
        backgroundColor: "var(--alert-error-bg)",
        borderColor:     "var(--alert-error-border)",
        color:           "var(--alert-error-text)",
      }}
    >
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
          <QuickCreateModal />
        )}
      </div>

      {!result.ok ? (
        <ErrorState message={result.error} />
      ) : result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <ContactosClient
          contactos={result.data}
          initialNextCursor={result.nextCursor}
          initialHasMore={result.hasMore}
        />
      )}
    </div>
  );
}
