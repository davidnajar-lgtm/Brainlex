// ============================================================================
// lib/prisma.ts — Singleton Prisma Client con Driver Adapter (Prisma 7 + pg)
//
// Patrón estándar Next.js para evitar instancias múltiples en hot-reload (dev).
// NUNCA importar PrismaClient directamente fuera de este módulo.
// ============================================================================
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
