// ============================================================================
// prisma/seed.ts — Semillas de Inteligencia del Motor SALI
//
// Siembra los 5 Cajones SALI definidos por el CEO:
//
//   CAJÓN 1 · IDENTIDAD   — Atributos intrínsecos del contacto   (GLOBAL)
//   CAJÓN 2 · DEPARTAMENTO — Área interna de trabajo             (scoped LX/LW)
//   CAJÓN 3 · SERVICIO     — Línea de servicio prestado          (scoped LX/LW)
//   CAJÓN 4 · ESTADO       — Estados de proceso del sistema      (GLOBAL)
//   CAJÓN 5 · INTELIGENCIA — Clasificación comercial/financiera  (GLOBAL)
//
// + Tipos de Relación del grafo de contactos
//
// REGLAS:
//   · Las 5 CATEGORÍAS son fijas (no editables desde UI)
//   · Las ETIQUETAS individuales son libres (es_sistema=false): editables, borrables, scope editable
//   · Idempotente: usa upsert por nombre — seguro ejecutar múltiples veces
//   · El CEO puede añadir/editar/borrar etiquetas desde /admin/taxonomia
//
// Ejecución: npm run db:seed
// ============================================================================

import { PrismaClient, EtiquetaScope } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" }); // override si existe

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

// ─── 5 Cajones SALI ───────────────────────────────────────────────────────────

const CAJONES: {
  nombre:      string;
  descripcion: string;
  orden:       number;
  etiquetas:   { nombre: string; color: string; scope: EtiquetaScope }[];
}[] = [
  // ── CAJÓN 1: IDENTIDAD ────────────────────────────────────────────────────
  // Atributos intrínsecos del contacto. Visibles para todos los tenants.
  {
    nombre:      "Identidad",
    descripcion: "Atributos fijos del contacto: tipo de relación jurídica, idioma, prioridad",
    orden:       1,
    etiquetas:   [
      { nombre: "Persona Física",    color: "#6366f1", scope: "GLOBAL" },
      { nombre: "Persona Jurídica",  color: "#8b5cf6", scope: "GLOBAL" },
      { nombre: "Extranjero",        color: "#06b6d4", scope: "GLOBAL" },
      { nombre: "Residente en España", color: "#0ea5e9", scope: "GLOBAL" },
    ],
  },

  // ── CAJÓN 2: DEPARTAMENTO ─────────────────────────────────────────────────
  // Área interna que gestiona el contacto. Scope por tenant.
  {
    nombre:      "Departamento",
    descripcion: "Área interna responsable — Nivel 1 de ruta en Google Drive (@File-Mirror)",
    orden:       2,
    etiquetas:   [
      // LX — Lexconomy
      { nombre: "Jurídico",      color: "#f97316", scope: "LEXCONOMY" },
      { nombre: "Fiscal",        color: "#f59e0b", scope: "LEXCONOMY" },
      { nombre: "Extranjería",   color: "#eab308", scope: "LEXCONOMY" },
      { nombre: "Secretaría",    color: "#84cc16", scope: "LEXCONOMY" },
      // LW — Lawork
      { nombre: "Construcción",  color: "#10b981", scope: "LAWTECH" },
      { nombre: "PRL",           color: "#14b8a6", scope: "LAWTECH" },
      { nombre: "CAE",           color: "#06b6d4", scope: "LAWTECH" },
    ],
  },

  // ── CAJÓN 3: SERVICIO ─────────────────────────────────────────────────────
  // Línea de servicio prestada. Nivel 2 de ruta en Drive (@File-Mirror).
  {
    nombre:      "Servicio",
    descripcion: "Línea de servicio prestado — Nivel 2 de ruta en Google Drive (@File-Mirror)",
    orden:       3,
    etiquetas:   [
      // LX — Lexconomy
      { nombre: "Herencia",             color: "#a855f7", scope: "LEXCONOMY" },
      { nombre: "Inmobiliario",         color: "#d946ef", scope: "LEXCONOMY" },
      { nombre: "Mercantil",            color: "#ec4899", scope: "LEXCONOMY" },
      { nombre: "Contabilidad",         color: "#f43f5e", scope: "LEXCONOMY" },
      { nombre: "Recursos Humanos",     color: "#fb7185", scope: "LEXCONOMY" },
      // LW — Lawork
      { nombre: "Obra Nueva",           color: "#34d399", scope: "LAWTECH" },
      { nombre: "Legalización",         color: "#6ee7b7", scope: "LAWTECH" },
      { nombre: "Coordinación Seguridad", color: "#a7f3d0", scope: "LAWTECH" },
    ],
  },

  // ── CAJÓN 4: ESTADO ───────────────────────────────────────────────────────
  // Estados de proceso del sistema. GLOBAL — usados como semáforo en expedientes.
  {
    nombre:      "Estado",
    descripcion: "Estados de ciclo de proceso — Facturado, Pendiente, Blueprint",
    orden:       4,
    etiquetas:   [
      { nombre: "Facturado",  color: "#10b981", scope: "GLOBAL" },
      { nombre: "Pendiente",  color: "#f59e0b", scope: "GLOBAL" },
      { nombre: "Blueprint",  color: "#6366f1", scope: "GLOBAL" },
      { nombre: "URGENTE",    color: "#ef4444", scope: "GLOBAL" },
      { nombre: "En Revisión", color: "#8b5cf6", scope: "GLOBAL" },
    ],
  },

  // ── CAJÓN 5: INTELIGENCIA ─────────────────────────────────────────────────
  // Clasificación comercial y financiera. GLOBAL.
  {
    nombre:      "Inteligencia",
    descripcion: "Clasificación comercial y financiera del contacto",
    orden:       5,
    etiquetas:   [
      { nombre: "VIP",          color: "#f59e0b", scope: "GLOBAL" },
      { nombre: "Moroso",       color: "#ef4444", scope: "GLOBAL" },
      { nombre: "Prescriptor",  color: "#8b5cf6", scope: "GLOBAL" },
      { nombre: "Referenciado", color: "#06b6d4", scope: "GLOBAL" },
    ],
  },
];

// ─── Tipos de Relación ────────────────────────────────────────────────────────

const TIPOS_RELACION: {
  nombre:      string;
  categoria:   string;
  color:       string;
  descripcion: string;
}[] = [
  {
    nombre:      "Socio de",
    categoria:   "Societaria",
    color:       "#6366f1",
    descripcion: "Vínculo de participación societaria entre dos entidades",
  },
  {
    nombre:      "Administrador de",
    categoria:   "Societaria",
    color:       "#8b5cf6",
    descripcion: "El contacto origen ejerce como administrador del contacto destino",
  },
  {
    nombre:      "Padre/Madre de",
    categoria:   "Familiar",
    color:       "#f97316",
    descripcion: "Vínculo de filiación directa entre personas físicas",
  },
  {
    nombre:      "Contrario en",
    categoria:   "Procesal",
    color:       "#ef4444",
    descripcion: "Las dos partes se encuentran en posiciones opuestas en un procedimiento",
  },
  {
    nombre:      "Apoderado de",
    categoria:   "Societaria",
    color:       "#0ea5e9",
    descripcion: "El contacto origen actúa con poderes notariales del contacto destino",
  },
  {
    nombre:      "Cónyuge de",
    categoria:   "Familiar",
    color:       "#ec4899",
    descripcion: "Vínculo conyugal entre dos personas físicas",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Iniciando siembra SALI Fase 3...\n");
  console.log("    @Scope-Guard activo — scopes LX/LW/GLOBAL aplicados");
  console.log("    @Time-Keeper activo — fecha_asignacion en EtiquetaAsignada\n");

  // ── Cajones + Etiquetas ────────────────────────────────────────────────────
  for (const cajon of CAJONES) {
    const categoria = await prisma.categoriaEtiqueta.upsert({
      where:  { nombre: cajon.nombre },
      update: { descripcion: cajon.descripcion, orden: cajon.orden },
      create: { nombre: cajon.nombre, descripcion: cajon.descripcion, orden: cajon.orden },
    });
    console.log(`  📦  Cajón [${cajon.orden}]: ${categoria.nombre}`);

    for (const etq of cajon.etiquetas) {
      await prisma.etiqueta.upsert({
        where:  { nombre_categoria_id: { nombre: etq.nombre, categoria_id: categoria.id } },
        update: { color: etq.color, scope: etq.scope, es_sistema: false },
        create: {
          nombre:     etq.nombre,
          color:      etq.color,
          es_sistema: false,
          scope:      etq.scope,
          categoria:  { connect: { id: categoria.id } },
        },
      });
      const scopeTag = etq.scope === "GLOBAL" ? "🌐" : etq.scope === "LEXCONOMY" ? "⚖️ LX" : "🏗️ LW";
      console.log(`         · ${etq.nombre}  ${scopeTag}`);
    }
  }

  // ── Tipos de Relación ──────────────────────────────────────────────────────
  console.log("\n  🔗  Tipos de Relación:");
  for (const tipo of TIPOS_RELACION) {
    await prisma.tipoRelacion.upsert({
      where:  { nombre: tipo.nombre },
      update: { color: tipo.color, categoria: tipo.categoria, descripcion: tipo.descripcion, es_sistema: true },
      create: {
        nombre:      tipo.nombre,
        color:       tipo.color,
        categoria:   tipo.categoria,
        descripcion: tipo.descripcion,
        es_sistema:  true,
      },
    });
    console.log(`       · ${tipo.nombre} [${tipo.categoria}]`);
  }

  console.log("\n🎯  Motor SALI Fase 3 sembrado correctamente.");
  console.log("    5 cajones · 24 etiquetas · 6 tipos de relación");
  console.log("    @File-Mirror: categorías DEPARTAMENTO y SERVICIO listas para Drive sync\n");
}

main()
  .catch((e) => {
    console.error("❌  Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
