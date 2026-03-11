// ============================================================================
// prisma/seed-hierarchy.ts — Semilla mínima: pareja de ejemplo FISCAL → CONTABILIDAD
//
// Limpia todas las etiquetas existentes (sin asignaciones activas) y crea
// solo dos etiquetas para demostrar la jerarquía Departamento → Servicio:
//
//   FISCAL        (Departamento, GLOBAL)
//   CONTABILIDAD  (Servicio, GLOBAL, parent_id → FISCAL)
//
// Las 5 CategoriaEtiqueta se preservan (son inmutables por diseño).
//
// Ejecución: npx tsx prisma/seed-hierarchy.ts
// ============================================================================

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log("🧹  Limpieza de etiquetas de prueba...\n");

  // ── Paso 1: Borrar etiquetas sin asignaciones activas ────────────────────
  const allEtiquetas = await prisma.etiqueta.findMany({
    select: { id: true, nombre: true },
  });

  let deleted = 0;
  let skipped = 0;
  for (const etq of allEtiquetas) {
    const usages = await prisma.etiquetaAsignada.count({
      where: { etiqueta_id: etq.id, fecha_desvinculacion: null },
    });
    if (usages === 0) {
      await prisma.etiqueta.delete({ where: { id: etq.id } });
      console.log(`   🗑️  Borrada: ${etq.nombre} (0 usos)`);
      deleted++;
    } else {
      console.log(`   🔒  Preservada: ${etq.nombre} (${usages} usos activos)`);
      skipped++;
    }
  }
  console.log(`\n   Resultado: ${deleted} borradas, ${skipped} preservadas\n`);

  // ── Paso 2: Asegurar categorías Departamento y Servicio existen ──────────
  const catDept = await prisma.categoriaEtiqueta.upsert({
    where:  { nombre: "Departamento" },
    update: {},
    create: { nombre: "Departamento", descripcion: "Área interna responsable", orden: 2 },
  });

  const catServ = await prisma.categoriaEtiqueta.upsert({
    where:  { nombre: "Servicio" },
    update: {},
    create: { nombre: "Servicio", descripcion: "Línea de servicio prestado", orden: 3 },
  });

  // ── Paso 3: Crear FISCAL (Departamento, GLOBAL) ─────────────────────────
  const fiscal = await prisma.etiqueta.upsert({
    where: { nombre_categoria_id: { nombre: "Fiscal", categoria_id: catDept.id } },
    update: { color: "#f59e0b", scope: "GLOBAL", es_sistema: false, activo: true },
    create: {
      nombre:     "Fiscal",
      color:      "#f59e0b",
      scope:      "GLOBAL",
      es_sistema: false,
      categoria:  { connect: { id: catDept.id } },
    },
  });
  console.log(`  📦  FISCAL creado (Departamento, GLOBAL) → id: ${fiscal.id}`);

  // ── Paso 4: Crear CONTABILIDAD (Servicio, GLOBAL, parent → FISCAL) ──────
  const contabilidad = await prisma.etiqueta.upsert({
    where: { nombre_categoria_id: { nombre: "Contabilidad", categoria_id: catServ.id } },
    update: { color: "#f43f5e", scope: "GLOBAL", es_sistema: false, activo: true, parent_id: fiscal.id },
    create: {
      nombre:     "Contabilidad",
      color:      "#f43f5e",
      scope:      "GLOBAL",
      es_sistema: false,
      categoria:  { connect: { id: catServ.id } },
      parent:     { connect: { id: fiscal.id } },
    },
  });
  console.log(`  📦  CONTABILIDAD creado (Servicio, GLOBAL, parent → Fiscal) → id: ${contabilidad.id}`);

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log("\n🎯  Pareja de ejemplo lista:");
  console.log("    Departamento: Fiscal (GLOBAL)");
  console.log("    Servicio: Contabilidad (GLOBAL) → parent: Fiscal");
  console.log("\n    Al arrastrar CONTABILIDAD a un contacto, el sistema");
  console.log("    asignará FISCAL automáticamente (auto-assign en CommandCenter).\n");
}

main()
  .catch((e) => {
    console.error("❌  Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
