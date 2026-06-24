import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();
router.use(authenticate);

/**
 * 入金・出金登録（振込のみ）。現金は Settlement（精算欄）で記録。
 */
const schema = z.object({
  caseId: z.string(),
  direction: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  scheduledDate: z.string().nullish(),
  executedDate: z.string().nullish(),
  amount: z.number().int(),
  counterparty: z.string().nullish(),
  bankName: z.string().nullish(),
  branchName: z.string().nullish(),
  accountType: z.enum(['ORDINARY', 'CURRENT', 'SAVINGS']).nullish(),
  accountNumber: z.string().nullish(),
  accountHolder: z.string().nullish(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
  note: z.string().nullish(),
});

const toDate = (v?: string | null) => (v ? new Date(v) : null);

router.post('/', denyViewer, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const c = await prisma.case.findUnique({ where: { id: parsed.data.caseId } });
  if (!c) return res.status(404).json({ error: '案件が見つかりません' });

  const p = await prisma.payment.create({
    data: {
      ...parsed.data,
      scheduledDate: toDate(parsed.data.scheduledDate),
      executedDate: toDate(parsed.data.executedDate),
      accountType: parsed.data.accountType ?? undefined,
    },
  });
  await audit(req, {
    action: parsed.data.direction === 'DEPOSIT' ? 'DEPOSIT_REGISTER' : 'WITHDRAWAL_REGISTER',
    caseNumber: c.caseNumber,
    entity: 'Payment',
    entityId: p.id,
    afterData: p,
    description: `${parsed.data.direction === 'DEPOSIT' ? '入金' : '出金'}登録`,
  });
  res.status(201).json(p);
});

router.put('/:id', denyViewer, async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  if (parsed.data.scheduledDate !== undefined) data.scheduledDate = toDate(parsed.data.scheduledDate);
  if (parsed.data.executedDate !== undefined) data.executedDate = toDate(parsed.data.executedDate);
  const p = await prisma.payment.update({ where: { id: req.params.id }, data });
  res.json(p);
});

router.get('/case/:caseId', async (req, res) => {
  const list = await prisma.payment.findMany({
    where: { caseId: req.params.caseId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list);
});

/** 一覧（入出金管理画面） */
router.get('/', async (req, res) => {
  const { direction, status } = req.query as Record<string, string>;
  const list = await prisma.payment.findMany({
    where: {
      direction: direction ? (direction as any) : undefined,
      status: status ? (status as any) : undefined,
    },
    include: { case: { select: { caseNumber: true, customer: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(list);
});

/** 現金精算（現金受領・現金支払） */
router.put('/settlement/:caseId', denyViewer, async (req, res) => {
  const s = z.object({
    cashReceived: z.number().int().default(0),
    cashPaid: z.number().int().default(0),
    customerPayment: z.number().int().default(0),
    customerReceipt: z.number().int().default(0),
  });
  const parsed = s.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const settlement = await prisma.settlement.upsert({
    where: { caseId: req.params.caseId },
    create: { caseId: req.params.caseId, ...parsed.data },
    update: parsed.data,
  });
  res.json(settlement);
});

export default router;
