"use client";

// ============================================================================
// components/layout/ClientProviders.tsx
//
// Wrapper client-side para todos los Context Providers.
// El layout raíz (RSC) no puede usar Context directamente — este componente
// actúa de puente.
// ============================================================================

import { TenantProvider } from "@/lib/context/TenantContext";
import { ToastProvider } from "@/components/ui/Toast";
import type { ReactNode } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </TenantProvider>
  );
}
