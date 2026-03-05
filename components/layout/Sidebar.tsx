"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

const BOTTOM_ITEMS = [
  {
    href: "/configuracion",
    label: "Configuración",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function LogoMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="11" y="11" width="14" height="14" rx="1" fill="none" stroke="#F97316" strokeWidth="1" strokeDasharray="3 1.5" transform="rotate(45 18 18)" />
      <circle cx="18" cy="18" r="2.5" fill="#F97316" />
      <line x1="18" y1="4" x2="18" y2="7" stroke="#F97316" strokeWidth="1" strokeLinecap="round" />
      <line x1="18" y1="29" x2="18" y2="32" stroke="#F97316" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col bg-zinc-950">
      {/* ── Logo / Brand ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-5">
        <LogoMark />
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight text-white">BRAINLEX</p>
          <p className="text-[8.5px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">Collective Genius Portal</p>
        </div>
      </div>

      {/* ── Tenant badge ─────────────────────────────────────── */}
      <div className="mx-4 mt-4 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Sociedad activa
        </p>
        <p className="mt-0.5 text-sm font-semibold text-zinc-100">
          Lexconomy SL
        </p>
        <span className="mt-1 inline-block rounded-sm bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
          LX
        </span>
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="mt-6 flex-1 px-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
          Menú principal
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  <span className={isActive ? "text-orange-400" : "text-zinc-600"}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Bottom items ─────────────────────────────────────── */}
      <div className="border-t border-zinc-800 px-3 py-3">
        <ul className="space-y-0.5">
          {BOTTOM_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  <span className={isActive ? "text-orange-400" : "text-zinc-600"}>
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
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-400 ring-1 ring-orange-500/30">
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
  );
}
