import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';
import { calcCaseTotals } from '../services/finance';
import { env } from '../config/env';
import { buildContractSnapshot } from '../services/contractSnapshot';

const router = Router();
router.use(authenticate);

/** POST /api/contracts  案件から契約書（ドラフト）を生成。顧客非表示項目は snapshot に含めない。 */
router.post('/', denyViewer, async (req, res) => {
  const { caseId, settlementMethod } = req.body as { caseId?: string; settlementMethod?: string };
  if (!caseId) return res.status(400).json({ error: 'caseId が必要です' });

  const snapshot = await buildContractSnapshot(caseId);
  if (!snapshot) return res.status(404).json({ error: '案件が見つかりません' });

  const token = crypto.randomBytes(24).toString('hex');
  const contentHash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

  const contract = await prisma.contract.create({
    data: {
      caseId,
      token,
      status: 'DRAFT',
      settlementMethod: (settlementMethod as any) ?? undefined,
      snapshot: snapshot as any,
      contentHash,
    },
  });

  await audit(req, {
    action: 'CONTRACT_ISSUE',
    caseNumber: snapshot.caseNumber,
    entity: 'Contract',
    entityId: contract.id,
    description: '契約書ドラフト作成',
  });

  res.status(201).json({ ...contract, url: `${env.appPublicUrl}/sign/${token}` });
});

/** POST /api/contracts/:id/send  顧客へURL送信（SMS/メール）。MVPではURLを返却。 */
router.post('/:id/send', denyViewer, async (req, res) => {
  const { channel } = req.body as { channel?: 'sms' | 'email' };
  const contract = await prisma.contract.update({
    where: { id: req.params.id },
    data: { status: 'SENT', sentAt: new Date() },
    include: { case: { include: { customer: true } } },
  });
  const url = `${env.appPublicUrl}/sign/${contract.token}`;
  // TODO: 実際の SMS/メール送信は外部サービス連携で実装。MVPではURLを返す。
  await audit(req, {
    action: 'CONTRACT_ISSUE',
    caseNumber: contract.case.caseNumber,
    entity: 'Contract',
    entityId: contract.id,
    description: `契約書URL送信 (${channel ?? 'manual'})`,
  });
  res.json({ ok: true, url, channel: channel ?? 'manual' });
});

router.get('/case/:caseId', async (req, res) => {
  const list = await prisma.contract.findMany({
    where: { caseId: req.params.caseId },
    include: { signature: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list.map((c) => ({ ...c, url: `${env.appPublicUrl}/sign/${c.token}` })));
});

router.get('/:id', async (req, res) => {
  const contract = await prisma.contract.findUnique({
    where: { id: req.params.id },
    include: { signature: true, case: true },
  });
  if (!contract) return res.status(404).json({ error: '契約書が見つかりません' });
  res.json({ ...contract, url: `${env.appPublicUrl}/sign/${contract.token}` });
});

export default router;
