-- Cola de replicación al sheet ERP (SheetSync).
CREATE TABLE "SheetSync" (
    "id"          TEXT NOT NULL,
    "tipo"        TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'PENDING',
    "attempts"    INTEGER NOT NULL DEFAULT 0,
    "lastError"   TEXT,
    "sentAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SheetSync_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SheetSync_status_idx" ON "SheetSync"("status");
CREATE INDEX "SheetSync_operationId_idx" ON "SheetSync"("operationId");
CREATE INDEX "SheetSync_createdAt_idx" ON "SheetSync"("createdAt");
