-- Fase 5: Health Check — historial de verificaciones de consistencia
CREATE TABLE "HealthCheck" (
    "id"       TEXT NOT NULL,
    "runAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"   TEXT NOT NULL,
    "info"     INTEGER NOT NULL DEFAULT 0,
    "warning"  INTEGER NOT NULL DEFAULT 0,
    "error"    INTEGER NOT NULL DEFAULT 0,
    "critical" INTEGER NOT NULL DEFAULT 0,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "auto"     BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HealthCheck_runAt_idx" ON "HealthCheck"("runAt");
