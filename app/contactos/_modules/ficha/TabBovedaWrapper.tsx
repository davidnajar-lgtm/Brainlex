"use client";

// ============================================================================
// app/contactos/_modules/ficha/TabBovedaWrapper.tsx
//
// Wrapper client que coordina TabBoveda + ModalConsejero.
// Se renderiza desde el RSC page.tsx cuando activeTab === "boveda".
// ============================================================================

import { useState, useCallback } from "react";
import { TabBoveda } from "./TabBoveda";
import { ModalConsejero } from "./ModalConsejero";

interface Props {
  contactoId: string;
}

export function TabBovedaWrapper({ contactoId }: Props) {
  const [consejeroOpen, setConsejeroOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleCreated = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <>
      <TabBoveda
        key={reloadKey}
        contactoId={contactoId}
        onOpenConsejero={() => setConsejeroOpen(true)}
      />
      <ModalConsejero
        open={consejeroOpen}
        onClose={() => setConsejeroOpen(false)}
        contactoId={contactoId}
        onCreated={handleCreated}
      />
    </>
  );
}
