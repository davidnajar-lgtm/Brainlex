"use client";

import Link from "next/link";
import {
  Activity,
  Contact,
  Briefcase,
  ShieldCheck,
  Network,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTenant } from "@/lib/context/TenantContext";

const ICON_MAP: Record<string, LucideIcon> = {
  identity:   Activity,
  filiacion:  Contact,
  operativa:  Briefcase,
  admin:      ShieldCheck,
  ecosistema: Network,
};

interface TabBarProps {
  tabs: { value: string; label: string }[];
  activeTab: string;
}

export function TabBar({ tabs, activeTab }: TabBarProps) {
  const { tenant } = useTenant();

  return (
    <div
      data-slot="tab-bar"
      className="shrink-0 border-b transition-colors duration-300"
      style={{ borderBottomColor: `${tenant.color}20` }}
    >
      {/* Borde superior diferenciador */}
      <div
        className="h-[3px]"
        style={{ background: `linear-gradient(90deg, #f59e0b, ${tenant.color}, #8b5cf6)` }}
      />
      <nav className="flex">
        {tabs.map(({ value, label }) => {
          const isActive = activeTab === value;
          const Icon = ICON_MAP[value];
          return (
            <Link
              key={value}
              href={`?tab=${value}`}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-all duration-200 border-b-2 ${
                isActive
                  ? ""
                  : "border-transparent text-zinc-600 hover:text-zinc-400"
              }`}
              style={isActive ? {
                borderBottomColor: tenant.color,
                color: tenant.color,
              } : undefined}
            >
              {Icon && <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={isActive ? { color: tenant.color } : undefined}
              />}
              <span className="hidden xl:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
