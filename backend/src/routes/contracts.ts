import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';
import { calcCaseTotals } from '../services/finance';
import { env } from '../config/env';
import { buildContractSnapshot } from '../services/contractSnapshot';
import { sendSms, sendEmail } from '../services/notify';

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

/** POST /api/contracts/:id/send  顧客へURL送信（SMS/メール実送信） */
router.post('/:id/send', denyViewer, async (req, res) => {
  const { channel } = req.body as { channel?: 'sms' | 'email' };
  const contract = await prisma.contract.findUnique({
    where: { id: req.params.id },
    include: { case: { include: { customer: true } } },
  });
  if (!contract) return res.status(404).json({ error: '契約書が見つかりません' });

  const url = `${env.appPublicUrl}/sign/${contract.token}`;
  const cust = contract.case.customer;
  const msg = `【${'Remoria Link'}】契約書のご確認・ご署名をお願いします。\n${url}`;

  try {
    if (channel === 'sms') {
      await sendSms(cust.phone, msg);
    } else if (channel === 'email') {
      await sendEmail(cust.email || '', '契約書のご確認のお願い', msg);
    } else {
      return res.status(400).json({ error: 'channel は sms か email を指定してください' });
    }
  } catch (e: any) {
    return res.status(502).json({ error: e?.message || '送信に失敗しました' });
  }

  await prisma.contract.update({ where: { id: contract.id }, data: { status: 'SENT', sentAt: new Date() } });
  await audit(req, {
    action: 'CONTRACT_ISSUE',
    caseNumber: contract.case.caseNumber,
    entity: 'Contract',
    entityId: contract.id,
    description: `契約書URL送信 (${channel})`,
  });
  res.json({ ok: true, url, channel });
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
