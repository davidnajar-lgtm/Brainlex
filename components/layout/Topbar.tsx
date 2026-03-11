"use client";

// ============================================================================
// components/layout/Topbar.tsx
//
// Barra superior con selector de tenant interactivo.
// @Scope-Guard: cambiar de tenant actualiza el contexto global en tiempo real.
// ============================================================================

import { useState, useRef, useEffect } from "react";
import WorldClock from "@/app/components/WorldClock";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTenant, TENANTS, type TenantId } from "@/lib/context/TenantContext";

// ─── TenantDropdown ───────────────────────────────────────────────────────────

function TenantDropdown() {
  const { tenant, isSuperAdmin, setTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  // Cierra al clicar fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const otherTenants = (Object.values(TENANTS) as typeof TENANTS[TenantId][]).filter(
    (t) => t.id !== tenant.id
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger — prominente con halo lateral */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-lg border px-3 py-1.5 text-sm transition-all duration-300"
        style={{
          borderColor: `${tenant.color}40`,
          backgroundColor: `${tenant.color}10`,
        }}
      >
        {/* Barra lateral de color */}
        <span
          className="h-5 w-[3px] rounded-full transition-colors duration-300"
          style={{ backgroundColor: tenant.color }}
        />
        <span
          className="font-semibold tracking-wide uppercase text-[11px] transition-colors duration-300"
          style={{ color: tenant.color }}
        >
          {tenant.id === "LX" ? "LEXCONOMY" : "LAWTECH"}
        </span>
        {isSuperAdmin && (
          <span
            className="rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${tenant.color}25`, color: tenant.color }}
          >
            CEO
          </span>
        )}
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: `${tenant.color}80` }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-xl shadow-black/40">
          {/* Tenant activo */}
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Empresa activa
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="h-5 w-[3px] rounded-full"
                style={{ backgroundColor: tenant.color }}
              />
              <div>
                <span className="text-sm font-semibold text-zinc-100">{tenant.nombre}</span>
                <span
                  className="ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: `${tenant.color}20`, color: tenant.color }}
                >
                  {tenant.id === "LX" ? "LEXCONOMY" : "LAWTECH"}
                </span>
              </div>
            </div>
          </div>

          {/* Cambiar a… */}
          <div className="px-2 py-1.5">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Cambiar a
            </p>
            {otherTenants.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTenant(t.id); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <span
                  className="h-4 w-[3px] rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.nombre}
                <span
                  className="ml-auto rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: `${t.color}20`, color: t.color }}
                >
                  {t.id === "LX" ? "LEXCONOMY" : "LAWTECH"}
                </span>
              </button>
            ))}
          </div>

          {/* Nota CEO */}
          {isSuperAdmin && (
            <div className="border-t border-zinc-800 px-3 py-2">
              <p className="text-[10px] text-zinc-600">
                Como <span className="text-zinc-400 font-medium">Superadmin</span>, los informes
                y la taxonomía muestran datos de todos los tenants.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

export default function Topbar({ title = "Panel de Control" }: { title?: string }) {
  const { tenant } = useTenant();

  return (
    <header className="print:hidden flex-shrink-0">
      {/* ── Halo de identidad — borde superior con color del tenant ── */}
      <div
        className="h-[3px] transition-colors duration-300"
        style={{ backgroundColor: tenant.color }}
      />
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
      {/* Page title */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-zinc-100">{title}</span>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-6">
        <WorldClock />

        <div className="h-5 w-px bg-zinc-800" />

        <ThemeToggle />

        <div className="h-5 w-px bg-zinc-800" />

        {/* Notification bell */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Notificaciones"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500" />
        </button>

        <div className="h-5 w-px bg-zinc-800" />

        {/* Tenant selector */}
        <TenantDropdown />
      </div>
      </div>
    </header>
  );
}
