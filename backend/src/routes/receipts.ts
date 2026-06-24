import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';
import { nextReceiptNumber } from '../lib/numbering';
import { getDefaultTaxRate, taxExcluded, taxAmount } from '../lib/tax';
import { generateReceiptPdf } from '../services/pdf';
import { env } from '../config/env';

const router = Router();
router.use(authenticate);

const schema = z.object({
  caseId: z.string(),
  recipientName: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().default('買取代金として'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'OFFSET']),
  registrationNumber: z.string().optional(),
  issuerName: z.string().default('Remoria Link 加盟店'),
  issuerAddress: z.string().optional(),
});

/** 領収書発行（発行後は編集不可。訂正は取消＋再発行） */
router.post('/', denyViewer, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const c = await prisma.case.findUnique({ where: { id: parsed.data.caseId } });
  if (!c) return res.status(404).json({ error: '案件が見つかりません' });

  const rate = await getDefaultTaxRate();
  const receiptNumber = await nextReceiptNumber();
  const token = crypto.randomBytes(20).toString('hex');
  const issuerInfo = {
    name: parsed.data.issuerName,
    address: parsed.data.issuerAddress,
    registrationNumber: parsed.data.registrationNumber,
  };
  const contentHash = crypto
    .createHash('sha256')
    .update(`${receiptNumber}|${parsed.data.amount}|${parsed.data.recipientName}`)
    .digest('hex');

  const receipt = await prisma.receipt.create({
    data: {
      receiptNumber,
      caseId: parsed.data.caseId,
      recipientName: parsed.data.recipientName,
      amount: parsed.data.amount,
      taxRate: rate,
      description: parsed.data.description,
      paymentMethod: parsed.data.paymentMethod,
      issuerInfo,
      registrationNumber: parsed.data.registrationNumber,
      token,
      contentHash,
    },
  });

  await audit(req, {
    action: 'RECEIPT_ISSUE',
    caseNumber: c.caseNumber,
    entity: 'Receipt',
    entityId: receipt.id,
    afterData: receipt,
    description: `領収書発行 ${receiptNumber}`,
  });

  res.status(201).json({ ...receipt, url: `${env.appPublicUrl}/receipt/${token}` });
});

/** 取消＋再発行（訂正履歴を残す） */
router.post('/:id/reissue', denyViewer, async (req, res) => {
  const old = await prisma.receipt.findUnique({ where: { id: req.params.id }, include: { case: true } });
  if (!old) return res.status(404).json({ error: '領収書が見つかりません' });
  if (old.status !== 'ISSUED') return res.status(400).json({ error: '発行済の領収書のみ再発行できます' });

  const { reason, amount, recipientName, description } = req.body as {
    reason?: string;
    amount?: number;
    recipientName?: string;
    description?: string;
  };

  const rate = await getDefaultTaxRate();
  const receiptNumber = await nextReceiptNumber();
  const token = crypto.randomBytes(20).toString('hex');

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.receipt.create({
      data: {
        receiptNumber,
        caseId: old.caseId,
        recipientName: recipientName ?? old.recipientName,
        amount: amount ?? old.amount,
        taxRate: rate,
        description: description ?? old.description,
        paymentMethod: old.paymentMethod,
        issuerInfo: old.issuerInfo as any,
        registrationNumber: old.registrationNumber,
        token,
        replacesId: old.id,
        contentHash: crypto.createHash('sha256').update(`${receiptNumber}|${amount ?? old.amount}`).digest('hex'),
      },
    });
    await tx.receipt.update({
      where: { id: old.id },
      data: { status: 'REISSUED', replacedById: created.id, cancelReason: reason },
    });
    return created;
  });

  await audit(req, {
    action: 'RECEIPT_ISSUE',
    caseNumber: old.case.caseNumber,
    entity: 'Receipt',
    entityId: result.id,
    beforeData: old,
    afterData: result,
    description: `領収書取消・再発行 理由:${reason ?? ''}`,
  });
  res.json({ ...result, url: `${env.appPublicUrl}/receipt/${token}` });
});

/** 取消のみ */
router.post('/:id/cancel', denyViewer, async (req, res) => {
  const { reason } = req.body as { reason?: string };
  const receipt = await prisma.receipt.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED', cancelReason: reason },
    include: { case: true },
  });
  await audit(req, {
    action: 'RECEIPT_ISSUE',
    caseNumber: receipt.case.caseNumber,
    entity: 'Receipt',
    entityId: receipt.id,
    description: `領収書取消 理由:${reason ?? ''}`,
  });
  res.json(receipt);
});

/**
 * 電子帳簿保存法対応：発行日・金額・取引先名で検索
 * GET /api/receipts?from=&to=&minAmount=&maxAmount=&recipient=
 */
router.get('/', async (req, res) => {
  const { from, to, minAmount, maxAmount, recipient } = req.query as Record<string, string>;
  const receipts = await prisma.receipt.findMany({
    where: {
      issuedAt: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(`${to}T23:59:59`) : undefined,
      },
      amount: {
        gte: minAmount ? Number(minAmount) : undefined,
        lte: maxAmount ? Number(maxAmount) : undefined,
      },
      recipientName: recipient ? { contains: recipient } : undefined,
    },
    include: { case: { select: { caseNumber: true } } },
    orderBy: { issuedAt: 'desc' },
    take: 300,
  });
  res.json(receipts);
});

router.get('/case/:caseId', async (req, res) => {
  const list = await prisma.receipt.findMany({
    where: { caseId: req.params.caseId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(list.map((r) => ({ ...r, url: `${env.appPublicUrl}/receipt/${r.token}` })));
});

/** PDF ダウンロード */
router.get('/:id/pdf', async (req, res) => {
  const r = await prisma.receipt.findUnique({ where: { id: req.params.id }, include: { case: true } });
  if (!r) return res.status(404).json({ error: '領収書が見つかりません' });
  const pdf = await generateReceiptPdf({
    receiptNumber: r.receiptNumber,
    issuedAt: r.issuedAt.toISOString().slice(0, 10),
    recipientName: r.recipientName,
    amount: r.amount,
    taxRate: r.taxRate,
    taxExcluded: taxExcluded(r.amount, r.taxRate),
    taxAmount: taxAmount(r.amount, r.taxRate),
    description: r.description || '',
    paymentMethod: r.paymentMethod,
    issuer: r.issuerInfo as any,
    caseNumber: r.case.caseNumber,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${r.receiptNumber}.pdf"`);
  res.send(pdf);
});

export default router;
