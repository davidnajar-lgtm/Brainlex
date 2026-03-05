"use client";

import { useEffect, useRef, useState } from "react";

const LS_KEY = "brainlex_wclock_pinned";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** "America/New_York" → "New York" */
function cityName(tz: string) {
  const parts = tz.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

/** "America/New_York" → "America" */
function region(tz: string) {
  return tz.split("/")[0];
}

/** "New York" → "NY" (max 3 chars, uppercased) */
function shortCode(tz: string) {
  return cityName(tz).slice(0, 3).toUpperCase();
}

function formatTime(date: Date, tz: string) {
  return date.toLocaleTimeString("es-ES", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatShort(date: Date, tz: string) {
  return date.toLocaleTimeString("es-ES", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(date: Date, tz: string) {
  return date.toLocaleDateString("es-ES", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function WorldClock() {
  // ── All state starts empty / null to avoid SSR mismatch ──
  const [now, setNow]         = useState<Date | null>(null);
  const [localTz, setLocalTz] = useState<string>("");
  const [allZones, setAllZones] = useState<string[]>([]);
  const [pinned, setPinned]   = useState<string[]>([]);
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // ── Client-only init: clock · timezone detection · Intl zones · localStorage ──
  useEffect(() => {
    // Detect local timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setLocalTz(tz);

    // Full zone list from Intl (client-only API)
    const zones = (
      Intl as unknown as { supportedValuesOf(k: string): string[] }
    ).supportedValuesOf("timeZone");
    setAllZones(zones);

    // Restore pinned from localStorage (read ONCE here, never overwritten by an effect)
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setPinned(JSON.parse(raw));
    } catch {
      // corrupted storage — start fresh
    }

    // Start clock tick
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Close on outside click ──
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── Focus search input when dropdown opens ──
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  // ── Toggle pin: write localStorage inline to avoid effect-ordering race ──
  function togglePinned(tz: string) {
    setPinned((prev) => {
      const next = prev.includes(tz)
        ? prev.filter((z) => z !== tz)
        : [...prev, tz];
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  // ── Filtered list: cap at 80 rows when searching, 60 when browsing ──
  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (q === "") return allZones.slice(0, 60);
    return allZones
      .filter(
        (tz) =>
          tz.toLowerCase().includes(q) ||
          cityName(tz).toLowerCase().includes(q)
      )
      .slice(0, 80);
  })();

  // ── Prevent hydration mismatch: render nothing until client mounted ──
  if (!now || !localTz) return null;

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {/* Globe icon */}
      <svg
        className="h-4 w-4 flex-shrink-0 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.75}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m-9 9h18"
        />
      </svg>

      {/* ── Clock trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-end gap-0.5 leading-none focus:outline-none"
        aria-label="Selector de zonas horarias"
      >
        {/* Primary time */}
        <span className="font-mono text-xs tabular-nums text-zinc-100 tracking-tight">
          {formatTime(now, localTz)}
        </span>
        <span className="text-[10px] text-zinc-500">
          {formatDate(now, localTz)}&nbsp;·&nbsp;{cityName(localTz)}
        </span>

        {/* Pinned zone row */}
        {pinned.length > 0 && (
          <span className="flex gap-2 mt-0.5">
            {pinned.map((tz) => (
              <span
                key={tz}
                className="font-mono text-[10px] tabular-nums text-zinc-400"
              >
                {shortCode(tz)}&nbsp;{formatShort(now, tz)}
              </span>
            ))}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute right-0 top-11 z-50 flex w-64 flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
          style={{ maxHeight: "22rem" }}
        >
          {/* Search header */}
          <div className="border-b border-zinc-800 px-3 pb-2 pt-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Zonas horarias
            </p>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ciudad o zona…"
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          {/* Pinned chips */}
          {pinned.length > 0 && (
            <div className="border-b border-zinc-800 px-3 pb-2 pt-2">
              <p className="mb-1.5 text-[10px] text-zinc-600">Fijadas</p>
              <div className="flex flex-wrap gap-1">
                {pinned.map((tz) => (
                  <button
                    key={tz}
                    onClick={() => togglePinned(tz)}
                    title={`Quitar ${tz}`}
                    className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:border-red-800 hover:text-red-400"
                  >
                    {cityName(tz)}
                    <span className="text-zinc-600">×</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Zone list */}
          <div className="flex-1 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-600">
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((tz) => {
                const active = pinned.includes(tz);
                return (
                  <button
                    key={tz}
                    onClick={() => togglePinned(tz)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                      active ? "text-zinc-100" : "text-zinc-400"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors ${
                          active ? "bg-emerald-500" : "bg-zinc-700"
                        }`}
                      />
                      <span className="truncate">{cityName(tz)}</span>
                      <span className="truncate text-[10px] text-zinc-600">
                        {region(tz)}
                      </span>
                    </span>
                    <span className="ml-2 flex-shrink-0 font-mono tabular-nums text-zinc-300">
                      {formatShort(now, tz)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-zinc-800 px-3 py-1.5">
            <p className="text-[10px] text-zinc-700">
              Haz clic en una zona para fijar · clic en el chip para quitar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
