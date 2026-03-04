// ============================================================================
// lib/prisma.ts — Singleton Prisma Client
//
// Patrón estándar Next.js para evitar instancias múltiples en hot-reload (dev).
// NUNCA importar PrismaClient directamente fuera de este módulo.
// ============================================================================
import { PrismaClient } from "@/app/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
