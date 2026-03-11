// ============================================================================
// app/admin/taxonomia/page.tsx — Panel de Administración: Sistema SALI
//
// @role: Agente de Frontend (RSC)
// @spec: Motor de Clasificación Multidimensional — Taxonomía SALI
//
// RSC: carga las categorías con sus etiquetas y las pasa al componente interactivo.
// Solo accesible por Admin.
// ============================================================================

import { getCategorias } from "@/lib/modules/entidades/actions/etiquetas.actions";
import { TaxonomiaClient } from "./TaxonomiaClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taxonomía SALI · Admin" };

export default async function TaxonomiaPage() {
  const result = await getCategorias();

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Taxonomia SALI</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          5 cajones fijos: Identidad, Departamento, Servicio, Estado e Inteligencia. Las etiquetas de usuario son editables por el administrador.
        </p>
      </div>

      {/* Aviso de arquitectura */}
      <div
        className="flex items-center gap-2 rounded-lg border px-4 py-2.5"
        style={{
          backgroundColor: "var(--alert-warning-bg)",
          borderColor:     "var(--alert-warning-border)",
        }}
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--alert-warning-icon)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-xs font-semibold" style={{ color: "var(--alert-warning-text)" }}>
          Los 5 cajones son fijos —{" "}
          <span className="font-normal" style={{ color: "var(--alert-warning-text-muted)" }}>
            todas las etiquetas son editables y borrables. Las de tipo Departamento y Servicio generan carpetas en Drive.
          </span>
        </p>
      </div>

      {!result.ok ? (
        <div
          className="rounded-xl border p-6 text-sm"
          style={{
            backgroundColor: "var(--alert-error-bg)",
            borderColor:     "var(--alert-error-border)",
            color:           "var(--alert-error-text)",
          }}
        >
          Error al cargar la taxonomía: {result.error}
        </div>
      ) : (
        <TaxonomiaClient initialCategorias={result.data} />
      )}
    </div>
  );
}
