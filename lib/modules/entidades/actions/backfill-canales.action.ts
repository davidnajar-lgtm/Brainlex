// ============================================================================
// lib/modules/entidades/actions/backfill-canales.action.ts
//
// @role: @Data-Architect — Migración silenciosa Fase 8.1.1
//
// Genera registros CanalComunicacion a partir de los campos denormalizados
// telefono_movil y telefono_fijo de Contacto. Idempotente: si el contacto
// ya tiene canales TELEFONO, se salta. El primer teléfono creado se marca
// como es_favorito=true (coherente con la lógica de crearCanal).
//
// Uso:
//   - Desde admin UI: importar y llamar backfillCanalesFromContactos()
//   - Desde CLI:      npx tsx lib/modules/entidades/actions/backfill-canales.action.ts
// ============================================================================
"use server";

import { prisma } from "@/lib/prisma";

export type BackfillResult = {
  ok: true;
  created: number;
  skipped: number;
  total: number;
};

/**
 * Migración silenciosa: crea registros CanalComunicacion para contactos
 * que tienen telefono_movil o telefono_fijo pero no tienen canales TELEFONO.
 *
 * Idempotente — seguro de ejecutar múltiples veces.
 */
export async function backfillCanalesFromContactos(): Promise<BackfillResult> {
  // Contactos con al menos un teléfono en campos denormalizados
  const contactos = await prisma.contacto.findMany({
    where: {
      OR: [
        { telefono_movil: { not: null } },
        { telefono_fijo:  { not: null } },
      ],
    },
    select: {
      id:             true,
      telefono_movil: true,
      telefono_fijo:  true,
      canales: {
        where: { tipo: "TELEFONO" },
        select: { id: true },
      },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const c of contactos) {
    // Si ya tiene canales TELEFONO, saltar
    if (c.canales.length > 0) {
      skipped++;
      continue;
    }

    const canalesData: {
      contactoId:  string;
      tipo:        string;
      subtipo:     string;
      valor:       string;
      etiqueta:    string;
      es_favorito: boolean;
    }[] = [];

    // Móvil primero (será favorito por defecto)
    if (c.telefono_movil) {
      canalesData.push({
        contactoId:  c.id,
        tipo:        "TELEFONO",
        subtipo:     "MOVIL",
        valor:       c.telefono_movil,
        etiqueta:    "MÓVIL PRINCIPAL",
        es_favorito: true, // Primer teléfono = favorito
      });
    }

    if (c.telefono_fijo) {
      canalesData.push({
        contactoId:  c.id,
        tipo:        "TELEFONO",
        subtipo:     "FIJO",
        valor:       c.telefono_fijo,
        etiqueta:    "FIJO PRINCIPAL",
        es_favorito: !c.telefono_movil, // Solo favorito si no hay móvil
      });
    }

    if (canalesData.length > 0) {
      await prisma.canalComunicacion.createMany({ data: canalesData });
      created += canalesData.length;
    }
  }

  return {
    ok:      true,
    created,
    skipped,
    total:   contactos.length,
  };
}
