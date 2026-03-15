"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenant } from "@/lib/context/TenantContext";
import { MiEmpresaButton } from "./MiEmpresaButton";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/contactos",
    label: "Contactos / Clientes",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/expedientes",
    label: "Expedientes",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    ),
  },
  {
    href: "/facturacion",
    label: "Facturación",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
];

const ADMIN_ITEMS = [
  {
    href: "/admin/cuarentena",
    label: "Archivo de Cuarentena",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    href: "/admin/taxonomia",
    label: "Taxonomía",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    href: "/admin/relaciones",
    label: "Relaciones",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
];

const BOTTOM_ITEMS = [
  {
    href: "/ayuda",
    label: "Centro de Ayuda",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826-3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function LogoMark({ color }: { color: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-colors duration-300">
      <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="11" y="11" width="14" height="14" rx="1" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 1.5" transform="rotate(45 18 18)" />
      <circle cx="18" cy="18" r="2.5" fill={color} />
      <line x1="18" y1="4" x2="18" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="29" x2="18" y2="32" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="print:hidden relative flex flex-shrink-0 h-screen">
      {/* ── Panel principal del sidebar ── */}
      <aside
        className={`relative flex h-full flex-col bg-zinc-950 transition-all duration-300 overflow-hidden ${
          collapsed ? "w-0" : "w-64"
        }`}
      >
        {/* ── Halo lateral — borde izquierdo con color del tenant ── */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300"
          style={{ backgroundColor: tenant.color }}
        />

        {/* ── Logo / Brand ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-5 min-w-[16rem]">
          <LogoMark color={tenant.color} />
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-white">BRAINLEX</p>
            <p className="text-[8.5px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">Collective Genius Portal</p>
          </div>
        </div>

        {/* ── Tenant badge — reactivo via TenantContext ─────────── */}
        <div
          className="mx-4 mt-4 rounded-md border px-3 py-2.5 transition-all duration-300 min-w-[14rem]"
          style={{
            borderColor: `${tenant.color}30`,
            backgroundColor: `${tenant.color}08`,
          }}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Sociedad activa
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-100">
            {tenant.nombre}
          </p>
          <span
            className="mt-1.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300"
            style={{ backgroundColor: `${tenant.color}20`, color: tenant.color }}
          >
            {tenant.id === "LX" ? "LEXCONOMY" : "LAWTECH"}
          </span>
        </div>

        {/* ── Navigation ───────────────────────────────────────── */}
        <nav className="mt-6 flex-1 px-3 min-w-[16rem]">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Menú principal
          </p>
          <ul className="space-y-0.5">
            {/* Atajo VIP — acceso directo a la bóveda de la empresa matriz */}
            <li>
              <MiEmpresaButton collapsed={collapsed} />
            </li>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? ""
                        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                    style={isActive ? {
                      backgroundColor: `${tenant.color}15`,
                      color: tenant.color,
                    } : undefined}
                  >
                    <span
                      className={isActive ? "" : "text-zinc-600"}
                      style={isActive ? { color: tenant.color } : undefined}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Admin / Compliance ───────────────────────────────── */}
        <div className="px-3 pb-2 min-w-[16rem]">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Administración
          </p>
          <ul className="space-y-0.5">
            {ADMIN_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? ""
                        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                    style={isActive ? {
                      backgroundColor: `${tenant.color}15`,
                      color: tenant.color,
                    } : undefined}
                  >
                    <span
                      className={isActive ? "" : "text-zinc-600"}
                      style={isActive ? { color: tenant.color } : undefined}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Bottom items ─────────────────────────────────────── */}
        <div className="border-t border-zinc-800 px-3 py-3 min-w-[16rem]">
          <ul className="space-y-0.5">
            {BOTTOM_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? ""
                        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                    style={isActive ? {
                      backgroundColor: `${tenant.color}15`,
                      color: tenant.color,
                    } : undefined}
                  >
                    <span
                      className={isActive ? "" : "text-zinc-600"}
                      style={isActive ? { color: tenant.color } : undefined}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* User stub */}
          <div className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 transition-colors duration-300"
              style={{
                backgroundColor: `${tenant.color}20`,
                color: tenant.color,
                boxShadow: `0 0 0 1px ${tenant.color}30`,
              }}
            >
              AJ
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-200">
                Arquitecto Jefe
              </p>
              <p className="truncate text-xs text-zinc-600">admin@brainlex.es</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Borde derecho con toggle — color del tenant ── */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="group relative flex h-full w-6 flex-shrink-0 cursor-pointer items-center justify-center transition-colors duration-300 hover:brightness-110"
        style={{ backgroundColor: tenant.color }}
        aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        title={collapsed ? "Expandir menú" : "Contraer menú"}
      >
        <svg
          className={`h-4 w-4 text-white/90 transition-transform duration-300 group-hover:text-white ${
            collapsed ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  );
}
