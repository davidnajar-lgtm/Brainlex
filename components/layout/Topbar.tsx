import WorldClock from "@/app/components/WorldClock";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function Topbar({ title = "Panel de Control" }: { title?: string }) {
  return (
    <header className="print:hidden flex h-14 flex-shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
      {/* Page title */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-zinc-100">{title}</span>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* World clock */}
        <WorldClock />

        <div className="h-5 w-px bg-zinc-800" />

        {/* Theme toggle */}
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
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-zinc-300">Lexconomy SL</span>
          <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </header>
  );
}
