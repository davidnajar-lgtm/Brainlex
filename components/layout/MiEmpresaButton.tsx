"use client";

// ============================================================================
// components/layout/MiEmpresaButton.tsx — Atajo VIP "Mi Empresa"
//
// Botón del Sidebar que navega directamente a la ficha de la matriz
// del tenant activo. Resuelve el contacto-matriz al primer clic,
// cachea el resultado, y navega instantáneamente en clicks posteriores.
//
// SEGURIDAD CISO:
//   · Usa el tenant del contexto actual (TenantContext)
//   · La Server Action filtra por tenant → imposible acceder a matriz ajena
//   · Si el tenant cambia, el caché se invalida automáticamente
// ============================================================================

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTenant } from "@/lib/context/TenantContext";
import { getMatrizContactId } from "@/lib/modules/entidades/actions/matriz.actions";

interface MiEmpresaButtonProps {
  /** Indica si el sidebar está colapsado (oculta label). */
  collapsed?: boolean;
}

export function MiEmpresaButton({ collapsed }: MiEmpresaButtonProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { tenant } = useTenant();

  // Caché del contactoId de la matriz — invalidado al cambiar de tenant
  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [cachedTenant, setCachedTenant] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  // Invalida caché al cambiar de tenant
  useEffect(() => {
    if (cachedTenant !== tenant.id) {
      setMatrizId(null);
      setCachedTenant(null);
      setError(false);
    }
  }, [tenant.id, cachedTenant]);

  const handleClick = useCallback(() => {
    // Si ya tenemos el ID en caché, navegar directamente
    if (matrizId && cachedTenant === tenant.id) {
      router.push(`/contactos/${matrizId}`);
      return;
    }

    // Resolver la matriz y navegar
    startTransition(async () => {
      setError(false);
      const result = await getMatrizContactId(tenant.id);
      if (result.ok && result.contactoId) {
        setMatrizId(result.contactoId);
        setCachedTenant(tenant.id);
        router.push(`/contactos/${result.contactoId}`);
      } else {
        setError(true);
      }
    });
  }, [matrizId, cachedTenant, tenant.id, router]);

  // Determinar si la ruta actual es la ficha de la matriz
  const isActive = matrizId ? pathname === `/contactos/${matrizId}` : false;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={
        error
          ? `No se encontró la empresa matriz de ${tenant.nombre}`
          : `Abrir ficha y bóveda de ${tenant.nombre}`
      }
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
        isActive
          ? ""
          : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
      } ${isPending ? "opacity-60" : ""}`}
      style={isActive ? {
        backgroundColor: `${tenant.color}15`,
        color: tenant.color,
      } : undefined}
    >
      <span
        className={isActive ? "" : "text-zinc-600"}
        style={isActive ? { color: tenant.color } : undefined}
      >
        {isPending ? (
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        )}
      </span>
      {!collapsed && (
        <span className="truncate">
          {error ? "Sin matriz configurada" : "Mi Empresa"}
        </span>
      )}
    </button>
  );
}
