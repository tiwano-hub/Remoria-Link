-- 顧客名カナを 苗字（カナ）・名（カナ）に分割
ALTER TABLE "Customer" ADD COLUMN "lastNameKana" TEXT;
ALTER TABLE "Customer" ADD COLUMN "firstNameKana" TEXT;
