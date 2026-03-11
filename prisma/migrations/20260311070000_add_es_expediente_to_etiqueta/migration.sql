-- AlterTable: add es_expediente boolean to etiquetas
ALTER TABLE "etiquetas" ADD COLUMN "es_expediente" BOOLEAN NOT NULL DEFAULT false;
