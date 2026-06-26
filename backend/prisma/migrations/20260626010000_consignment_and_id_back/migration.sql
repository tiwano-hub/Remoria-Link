-- 買取方法に「委託」を追加
ALTER TYPE "PurchaseMethod" ADD VALUE IF NOT EXISTS 'CONSIGNMENT';

-- 身分証の裏面画像（免許証・健康保険証で使用）
ALTER TABLE "IdentityVerification" ADD COLUMN "imageUrlBack" TEXT;
