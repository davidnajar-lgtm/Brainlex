/*
  Warnings:

  - You are about to drop the column `created_at` on the `etiquetas_asignadas` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EtiquetaScope" AS ENUM ('GLOBAL', 'LEXCONOMY', 'LAWTECH');

-- AlterTable
ALTER TABLE "etiquetas" ADD COLUMN     "scope" "EtiquetaScope" NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "etiquetas_asignadas" DROP COLUMN "created_at",
ADD COLUMN     "fecha_asignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fecha_desvinculacion" TIMESTAMP(3);
