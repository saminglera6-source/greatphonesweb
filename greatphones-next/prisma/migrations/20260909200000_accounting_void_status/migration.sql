-- Fase 3: anulación reversible de asientos contables (nunca se borra un asiento)
ALTER TABLE "AccountingEntry"
  ADD COLUMN "status"     TEXT NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN "reversalOf" TEXT,
  ADD COLUMN "voidedAt"   TIMESTAMP(3),
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "voidedBy"   TEXT;

CREATE INDEX "AccountingEntry_status_idx" ON "AccountingEntry"("status");
CREATE INDEX "AccountingEntry_operationId_idx" ON "AccountingEntry"("operationId");

-- Baja lógica de usuarios (no se borran si tienen operaciones)
ALTER TABLE "User"
  ADD COLUMN "active"            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deactivatedAt"     TIMESTAMP(3),
  ADD COLUMN "deactivatedReason" TEXT;

-- Estado "ANULADO" para equipos de una compra anulada (nunca se borra el ítem)
ALTER TYPE "InventoryStatus" ADD VALUE IF NOT EXISTS 'ANULADO';
