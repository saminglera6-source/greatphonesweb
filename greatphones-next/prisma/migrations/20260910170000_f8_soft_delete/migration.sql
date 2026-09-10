-- F8: soft-delete real en configuración de precios y conversaciones (ERP regla 1).
ALTER TABLE "PriceList"     ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedBy" TEXT, ADD COLUMN "deleteReason" TEXT;
ALTER TABLE "PriceTradeIn"  ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedBy" TEXT, ADD COLUMN "deleteReason" TEXT;
ALTER TABLE "CuotasConfig"  ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedBy" TEXT, ADD COLUMN "deleteReason" TEXT;
ALTER TABLE "Conversation"  ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedBy" TEXT, ADD COLUMN "deleteReason" TEXT;

CREATE INDEX "PriceList_deletedAt_idx"    ON "PriceList"("deletedAt");
CREATE INDEX "PriceTradeIn_deletedAt_idx" ON "PriceTradeIn"("deletedAt");
CREATE INDEX "Conversation_deletedAt_idx" ON "Conversation"("deletedAt");
