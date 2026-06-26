-- 本人確認に身分証番号（対面時に控える）を追加
ALTER TABLE "IdentityVerification" ADD COLUMN "documentNumber" TEXT;
