-- CreateEnum
CREATE TYPE "ContactoTipo" AS ENUM ('PERSONA_FISICA', 'PERSONA_JURIDICA');

-- CreateEnum
CREATE TYPE "ContactoStatus" AS ENUM ('ACTIVE', 'QUARANTINE', 'FORGOTTEN');

-- CreateEnum
CREATE TYPE "FiscalIdTipo" AS ENUM ('NIF', 'CIF', 'NIE', 'DNI', 'PASAPORTE', 'VAT', 'TIE', 'K', 'L', 'M', 'REGISTRO_EXTRANJERO', 'CODIGO_SOPORTE', 'SIN_REGISTRO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'QUARANTINE', 'RESTORE', 'FORGET');

-- CreateTable
CREATE TABLE "sociedades_holding" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nif" TEXT,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "quarantine_months" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sociedades_holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos" (
    "id" TEXT NOT NULL,
    "tipo" "ContactoTipo" NOT NULL DEFAULT 'PERSONA_FISICA',
    "nombre" TEXT,
    "apellido1" TEXT,
    "apellido2" TEXT,
    "razon_social" TEXT,
    "tipo_sociedad" TEXT,
    "fiscal_id" TEXT,
    "fiscal_id_tipo" "FiscalIdTipo",
    "email_principal" TEXT,
    "telefono_movil" TEXT,
    "telefono_fijo" TEXT,
    "website_url" TEXT,
    "linkedin_url" TEXT,
    "canal_preferido" TEXT NOT NULL DEFAULT 'EMAIL',
    "es_cliente" BOOLEAN NOT NULL DEFAULT false,
    "es_precliente" BOOLEAN NOT NULL DEFAULT false,
    "es_contacto" BOOLEAN NOT NULL DEFAULT true,
    "es_facturadora" BOOLEAN NOT NULL DEFAULT false,
    "es_entidad_activa" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContactoStatus" NOT NULL DEFAULT 'ACTIVE',
    "quarantine_reason" TEXT,
    "quarantine_expires_at" TIMESTAMP(3),
    "forgotten_at" TIMESTAMP(3),
    "cnae" TEXT,
    "iae" TEXT,
    "prorrata_pct" INTEGER,
    "hacienda_status" TEXT,
    "last_accounts_year" INTEGER,
    "last_books_year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacto_company_links" (
    "id" TEXT NOT NULL,
    "contacto_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacto_company_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedientes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fuera_de_cuota" BOOLEAN NOT NULL DEFAULT false,
    "propuesta_firmada_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "contacto_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "etiqueta" TEXT,
    "calle" TEXT NOT NULL,
    "calle_2" TEXT,
    "codigo_postal" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'ES',
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canales_comunicacion" (
    "id" TEXT NOT NULL,
    "contactoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "subtipo" TEXT,
    "valor" TEXT NOT NULL,
    "etiqueta" TEXT,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "es_favorito" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canales_comunicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_relacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_relacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relaciones" (
    "id" TEXT NOT NULL,
    "origen_id" TEXT NOT NULL,
    "destino_id" TEXT NOT NULL,
    "tipo_relacion_id" TEXT NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_etiqueta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_etiqueta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "categoria_id" TEXT NOT NULL,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas_asignadas" (
    "id" TEXT NOT NULL,
    "etiqueta_id" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "entidad_tipo" TEXT NOT NULL,
    "asignado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etiquetas_asignadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actor_id" TEXT,
    "actor_email" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "notes" TEXT,
    "hash_identificador" TEXT,
    "base_legal" TEXT,
    "meta_counts" JSONB,
    "purgeable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sociedades_holding_company_id_key" ON "sociedades_holding"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "contactos_email_principal_key" ON "contactos"("email_principal");

-- CreateIndex
CREATE INDEX "contactos_status_idx" ON "contactos"("status");

-- CreateIndex
CREATE INDEX "contactos_es_cliente_es_precliente_es_facturadora_idx" ON "contactos"("es_cliente", "es_precliente", "es_facturadora");

-- CreateIndex
CREATE UNIQUE INDEX "contactos_fiscal_id_fiscal_id_tipo_key" ON "contactos"("fiscal_id", "fiscal_id_tipo");

-- CreateIndex
CREATE UNIQUE INDEX "contacto_company_links_contacto_id_company_id_key" ON "contacto_company_links"("contacto_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "expedientes_codigo_key" ON "expedientes"("codigo");

-- CreateIndex
CREATE INDEX "expedientes_company_id_idx" ON "expedientes"("company_id");

-- CreateIndex
CREATE INDEX "expedientes_status_idx" ON "expedientes"("status");

-- CreateIndex
CREATE INDEX "direcciones_contactoId_idx" ON "direcciones"("contactoId");

-- CreateIndex
CREATE INDEX "canales_comunicacion_contactoId_idx" ON "canales_comunicacion"("contactoId");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_relacion_nombre_key" ON "tipos_relacion"("nombre");

-- CreateIndex
CREATE INDEX "tipos_relacion_categoria_idx" ON "tipos_relacion"("categoria");

-- CreateIndex
CREATE INDEX "relaciones_origen_id_idx" ON "relaciones"("origen_id");

-- CreateIndex
CREATE INDEX "relaciones_destino_id_idx" ON "relaciones"("destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "relaciones_origen_id_destino_id_tipo_relacion_id_key" ON "relaciones"("origen_id", "destino_id", "tipo_relacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_etiqueta_nombre_key" ON "categorias_etiqueta"("nombre");

-- CreateIndex
CREATE INDEX "etiquetas_categoria_id_idx" ON "etiquetas"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_nombre_categoria_id_key" ON "etiquetas"("nombre", "categoria_id");

-- CreateIndex
CREATE INDEX "etiquetas_asignadas_entidad_id_entidad_tipo_idx" ON "etiquetas_asignadas"("entidad_id", "entidad_tipo");

-- CreateIndex
CREATE INDEX "etiquetas_asignadas_etiqueta_id_idx" ON "etiquetas_asignadas"("etiqueta_id");

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_asignadas_etiqueta_id_entidad_id_entidad_tipo_key" ON "etiquetas_asignadas"("etiqueta_id", "entidad_id", "entidad_tipo");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_hash_identificador_idx" ON "audit_logs"("hash_identificador");

-- AddForeignKey
ALTER TABLE "contacto_company_links" ADD CONSTRAINT "contacto_company_links_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "contactos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacto_company_links" ADD CONSTRAINT "contacto_company_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sociedades_holding"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "contactos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "sociedades_holding"("company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canales_comunicacion" ADD CONSTRAINT "canales_comunicacion_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relaciones" ADD CONSTRAINT "relaciones_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "contactos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relaciones" ADD CONSTRAINT "relaciones_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "contactos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relaciones" ADD CONSTRAINT "relaciones_tipo_relacion_id_fkey" FOREIGN KEY ("tipo_relacion_id") REFERENCES "tipos_relacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etiquetas" ADD CONSTRAINT "etiquetas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_etiqueta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etiquetas_asignadas" ADD CONSTRAINT "etiquetas_asignadas_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
