-- AlterTable: ciclo de preventa Fase 1 — tracking de cobro, vendedor, venta reusable
ALTER TABLE "PreOrder"
  ADD COLUMN "collectedArs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "collectedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "sellerName" TEXT,
  ADD COLUMN "saleCode" TEXT;

-- El default del estado pasa a un valor canónico y se normalizan las filas
-- históricas (ESPERANDO_COMPRA | COMPRADO | ENTREGADO_SALDO | ENTREGADO | CANCELADO).
ALTER TABLE "PreOrder" ALTER COLUMN "status" SET DEFAULT 'ESPERANDO_COMPRA';
UPDATE "PreOrder" SET "status" = 'ESPERANDO_COMPRA' WHERE "status" = 'PENDING';
UPDATE "PreOrder" SET "status" = 'COMPRADO'         WHERE "status" IN ('PAID', 'CONFIRMED', 'PROCESSING');
UPDATE "PreOrder" SET "status" = 'ENTREGADO'        WHERE "status" IN ('DELIVERED', 'SOLD');
UPDATE "PreOrder" SET "status" = 'CANCELADO'        WHERE "status" = 'CANCELLED';

-- Backfill de collectedArs para preventas ya entregadas sin dato de cobro:
-- se asume que se cobró el precio completo (era el comportamiento anterior).
UPDATE "PreOrder" SET "collectedArs" = "price"
  WHERE "status" = 'ENTREGADO' AND "collectedArs" = 0;

-- CreateTable: feriados para días hábiles (plazo de entrega de preventas)
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");
