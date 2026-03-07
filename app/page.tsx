// Dashboard principal — BrainLex ERP
import { prisma } from "@/lib/prisma";

function buildStats(contactosActivos: number, cuarentena: number) {
  return [
  {
    label: "Contactos activos",
    value: String(contactosActivos),
    sub: "Clientes y contactos",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Expedientes abiertos",
    value: "—",
    sub: "En curso",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    ),
  },
  {
    label: "Facturación del mes",
    value: "—",
    sub: "Pendiente de integración Holded",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    label: "Alertas de cuarentena",
    value: String(cuarentena),
    sub: "Contactos en revisión legal",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  ]; // fin buildStats
}

const QUICK_ACTIONS = [
  { label: "Nuevo Contacto", href: "/contactos/nuevo", description: "Registrar cliente, pre-cliente o contacto" },
  { label: "Nuevo Expediente", href: "/expedientes/nuevo", description: "Abrir expediente de trabajo" },
  { label: "Gestionar Cuarentena", href: "/contactos", description: "Revisar bajas legales pendientes" },
];


export default async function DashboardPage() {
  const [contactosActivos, cuarentena] = await Promise.all([
    prisma.contacto.count({ where: { status: "ACTIVE", is_active: true } }),
    prisma.contacto.count({ where: { status: "QUARANTINE" } }),
  ]);
  const STATS = buildStats(contactosActivos, cuarentena);

  return (
    <div className="space-y-5">
      {/* Header de bienvenida */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">
              BrainLex ERP — Panel de Control
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Sistema de gestión legal y fiscal
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-900/60 bg-emerald-950/60 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-400">Sistema operativo</span>
          </div>
        </div>

      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">{stat.label}</p>
              <span className={`rounded-lg p-2 ${stat.iconBg} ${stat.iconColor}`}>
                {stat.icon}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-zinc-100">{stat.value}</p>
            <p className="mt-0.5 text-xs text-zinc-600">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Fila inferior */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Acciones rápidas */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-300">Acciones rápidas</h2>
          <ul className="mt-3 space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <li key={action.label}>
                <a
                  href={action.href}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3 text-sm transition-colors hover:border-orange-500/30 hover:bg-orange-500/5"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{action.label}</p>
                    <p className="text-xs text-zinc-600">{action.description}</p>
                  </div>
                  <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Actividad reciente — placeholder */}
        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-300">Actividad reciente</h2>
          <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-zinc-800 p-4">
              <svg className="h-8 w-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-500">Sin actividad registrada</p>
            <p className="mt-1 text-xs text-zinc-700">
              El AuditLog se poblará al operar con Contactos y Expedientes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
