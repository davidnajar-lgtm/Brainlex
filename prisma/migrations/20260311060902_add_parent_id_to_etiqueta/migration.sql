-- AlterTable
ALTER TABLE "etiquetas" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "etiquetas_parent_id_idx" ON "etiquetas"("parent_id");

-- AddForeignKey
ALTER TABLE "etiquetas" ADD CONSTRAINT "etiquetas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "etiquetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
