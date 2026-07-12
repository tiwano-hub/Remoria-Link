-- 外注先マスタ
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subcontractor_name_key" ON "Subcontractor"("name");

-- 原価オプションに外注先
ALTER TABLE "CostOption" ADD COLUMN "subcontractor" TEXT;
