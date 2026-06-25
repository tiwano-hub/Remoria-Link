-- 顧客名を姓・名に分割（既存の name は互換のため維持）
ALTER TABLE "Customer" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "firstName" TEXT;
