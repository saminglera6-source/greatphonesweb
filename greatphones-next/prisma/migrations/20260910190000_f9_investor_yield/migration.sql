-- F9: rendimientos mensuales de inversores como entidad propia (ERP §3.17).
CREATE TABLE "InvestorYield" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "capitalBase" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMP(3),
    "operator" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestorYield_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvestorYield_investorId_period_key" ON "InvestorYield"("investorId", "period");
CREATE INDEX "InvestorYield_investorId_idx" ON "InvestorYield"("investorId");
CREATE INDEX "InvestorYield_status_idx" ON "InvestorYield"("status");
ALTER TABLE "InvestorYield" ADD CONSTRAINT "InvestorYield_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: los rendimientos ya generados vivían como InvestorMovement amount=0 con detail 'Rendimiento YYYY-MM'.
INSERT INTO "InvestorYield" ("id", "investorId", "period", "capitalBase", "amount", "status", "createdAt")
SELECT
  'iy_' || m."id",
  m."investorId",
  regexp_replace(m."detail", '^Rendimiento ', ''),
  m."capitalAfter",
  ROUND(m."capitalAfter" * i."yieldRate" / 100.0),
  'PENDIENTE',
  m."createdAt"
FROM "InvestorMovement" m
JOIN "Investor" i ON i."id" = m."investorId"
WHERE m."type" = 'PAGO_RENDIMIENTO' AND m."amount" = 0 AND m."detail" LIKE 'Rendimiento %'
ON CONFLICT ("investorId", "period") DO NOTHING;
