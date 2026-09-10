-- Fase 6: tarifario Icare + compra de accesorios + costo promedio ponderado

ALTER TABLE "Accessory" ADD COLUMN "lastCost" INTEGER NOT NULL DEFAULT 0;
UPDATE "Accessory" SET "lastCost" = "cost";

CREATE TABLE "IcareTariff" (
    "id"           TEXT NOT NULL,
    "modelo"       TEXT NOT NULL,
    "categoria"    TEXT NOT NULL,
    "modeloNorm"   TEXT NOT NULL,
    "precioGuia"   INTEGER NOT NULL DEFAULT 0,
    "precioPublico" INTEGER NOT NULL DEFAULT 0,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IcareTariff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IcareTariff_modeloNorm_categoria_idx" ON "IcareTariff"("modeloNorm", "categoria");
CREATE INDEX "IcareTariff_modelo_idx" ON "IcareTariff"("modelo");

CREATE TABLE "AccessoryPurchase" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "proveedor"   TEXT,
    "accessoryId" TEXT NOT NULL,
    "categoria"   TEXT,
    "producto"    TEXT NOT NULL,
    "cantidad"    INTEGER NOT NULL,
    "costoUnit"   INTEGER NOT NULL,
    "precioVenta" INTEGER,
    "operator"    TEXT,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessoryPurchase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccessoryPurchase_code_idx" ON "AccessoryPurchase"("code");
CREATE INDEX "AccessoryPurchase_accessoryId_idx" ON "AccessoryPurchase"("accessoryId");
ALTER TABLE "AccessoryPurchase" ADD CONSTRAINT "AccessoryPurchase_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
