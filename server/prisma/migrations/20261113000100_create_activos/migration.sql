-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Needed by the title substring search index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('imagen', 'video', 'pdf');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "EstadoActivo" AS ENUM ('ACTIVO', 'ELIMINANDO', 'ERROR_BORRADO', 'NUBE_ELIMINADA');

-- CreateTable
CREATE TABLE "Activo" (
    "id" UUID NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "nombreOriginal" VARCHAR(255) NOT NULL,
    "secureUrl" VARCHAR(2048) NOT NULL,
    "publicId" VARCHAR(255) NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "fechaSubida" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" VARCHAR(100) NOT NULL,
    "estado" "EstadoActivo" NOT NULL DEFAULT 'ACTIVO',
    "intentosBorrado" INTEGER NOT NULL DEFAULT 0,
    "borradoIniciadoEn" TIMESTAMPTZ(3),
    "ultimoErrorCodigo" VARCHAR(64),
    "actualizadoEn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Activo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activo_estado_fechaSubida_id_idx" ON "Activo"("estado", "fechaSubida" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Activo_estado_categoria_fechaSubida_id_idx" ON "Activo"("estado", "categoria", "fechaSubida" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Activo_titulo_trgm_idx" ON "Activo" USING GIN ("titulo" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Activo_publicId_resourceType_key" ON "Activo"("publicId", "resourceType");

-- Invariants at the database boundary, in addition to future form validation.
ALTER TABLE "Activo"
  ADD CONSTRAINT "Activo_tamanoBytes_check" CHECK ("tamanoBytes" > 0 AND "tamanoBytes" <= 10485760),
  ADD CONSTRAINT "Activo_secureUrl_check" CHECK ("secureUrl" ~ '^https://[^/[:space:]]+/' ),
  ADD CONSTRAINT "Activo_texto_check" CHECK (
    length(btrim("titulo")) > 0 AND length(btrim("subidoPor")) > 0 AND
    length(btrim("nombreOriginal")) > 0 AND length(btrim("publicId")) > 0
  ),
  ADD CONSTRAINT "Activo_intentosBorrado_check" CHECK ("intentosBorrado" >= 0),
  ADD CONSTRAINT "Activo_tipo_check" CHECK (
    ("categoria" = 'imagen' AND "resourceType" = 'image' AND "mimeType" IN ('image/jpeg', 'image/png', 'image/webp')) OR
    ("categoria" = 'video' AND "resourceType" = 'video' AND "mimeType" IN ('video/mp4', 'video/webm')) OR
    ("categoria" = 'pdf' AND "resourceType" = 'image' AND "mimeType" = 'application/pdf')
  );
