import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();

/**
 * 本人確認登録。古物営業法に準拠。
 * 非対面取引（宅配等）では「身分証画像アップロードのみ」を拒否し、
 * 施行規則に定める追加方法（本人限定受取郵便・転送不要書留・ICチップ・電子署名等）を必須とする。
 */
const schema = z.object({
  caseId: z.string(),
  method: z.enum([
    'FACE_TO_FACE',
    'NONFACE_REGISTERED_MAIL',
    'NONFACE_ID_IMAGE_PLUS',
    'NONFACE_IC_CHIP',
    'NONFACE_E_SIGNATURE',
  ]),
  documentType: z.enum([
    'DRIVERS_LICENSE',
    'MY_NUMBER_CARD',
    'PASSPORT',
    'RESIDENCE_CARD',
    'HEALTH_INSURANCE',
    'OTHER',
  ]),
  imageUrl: z.string().nullish(),
  verifiedAt: z.string().nullish(),
  verificationLog: z.any().optional(),
});

// 顧客署名画面など認証なしでも登録できるよう、token 経由は別途 public ルートで扱う
router.use(authenticate);

router.post('/', denyViewer, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const c = await prisma.case.findUnique({ where: { id: parsed.data.caseId } });
  if (!c) return res.status(404).json({ error: '案件が見つかりません' });

  // 非対面（宅配）で画像のみは不可のチェック
  if (c.purchaseMethod === 'DELIVERY' && parsed.data.method === 'FACE_TO_FACE') {
    return res.status(400).json({ error: '宅配（非対面）取引では対面確認は選択できません' });
  }

  const rec = await prisma.identityVerification.create({
    data: {
      caseId: parsed.data.caseId,
      method: parsed.data.method,
      documentType: parsed.data.documentType,
      imageUrl: parsed.data.imageUrl ?? undefined,
      verifiedAt: parsed.data.verifiedAt ? new Date(parsed.data.verifiedAt) : new Date(),
      verifierId: req.user!.id,
      verificationLog: {
        ...(parsed.data.verificationLog ?? {}),
        verifierName: req.user!.name,
        recordedAt: new Date().toISOString(),
      },
    },
  });

  await audit(req, {
    action: 'IDENTITY_REGISTER',
    caseNumber: c.caseNumber,
    entity: 'IdentityVerification',
    entityId: rec.id,
    afterData: { ...rec, imageUrl: rec.imageUrl ? '[stored]' : null },
    description: `本人確認登録 (${parsed.data.method})`,
  });
  res.status(201).json(rec);
});

router.get('/case/:caseId', async (req, res) => {
  const list = await prisma.identityVerification.findMany({
    where: { caseId: req.params.caseId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list);
});

export default router;
