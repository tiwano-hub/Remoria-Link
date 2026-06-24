import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();
router.use(authenticate);

const itemSchema = z.object({
  caseId: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().min(0).default(1),
  grade: z.enum(['N', 'S', 'A', 'B', 'C', 'D', 'E', 'J', 'NONE']).default('NONE'),
  purchaseAmount: z.number().int().default(0),
  expectedAmount: z.number().int().default(0),
  salesChannel: z.string().nullish(),
  note: z.string().nullish(),
  showOnContract: z.boolean().default(true),
});

/** 買取品明細 追加 */
router.post('/', denyViewer, async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.purchaseItem.create({ data: parsed.data });
  await audit(req, { action: 'CASE_UPDATE', entity: 'PurchaseItem', entityId: item.id, afterData: item, description: '買取品明細 追加' });
  res.status(201).json(item);
});

/** 買取品明細 更新（金額変更は監査） */
router.put('/:id', denyViewer, async (req, res) => {
  const before = await prisma.purchaseItem.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: '明細が見つかりません' });
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.purchaseItem.update({ where: { id: req.params.id }, data: parsed.data });
  const amountChanged =
    parsed.data.purchaseAmount !== undefined && parsed.data.purchaseAmount !== before.purchaseAmount;
  await audit(req, {
    action: amountChanged ? 'AMOUNT_CHANGE' : 'CASE_UPDATE',
    entity: 'PurchaseItem',
    entityId: item.id,
    beforeData: before,
    afterData: item,
    description: amountChanged ? '買取金額変更' : '買取品明細 更新',
  });
  res.json(item);
});

/** 失点処理：契約書/金額/在庫に反映しないが記録は残す */
router.post('/:id/lost', denyViewer, async (req, res) => {
  const { reason } = req.body as { reason?: string };
  const item = await prisma.purchaseItem.update({
    where: { id: req.params.id },
    data: { isLost: true, lostReason: reason ?? null, showOnContract: false },
  });
  await audit(req, { action: 'CASE_UPDATE', entity: 'PurchaseItem', entityId: item.id, afterData: item, description: `失点処理: ${reason ?? ''}` });
  res.json(item);
});

/** 失点解除 */
router.post('/:id/unlost', denyViewer, async (req, res) => {
  const item = await prisma.purchaseItem.update({
    where: { id: req.params.id },
    data: { isLost: false, lostReason: null },
  });
  res.json(item);
});

router.delete('/:id', denyViewer, async (req, res) => {
  const before = await prisma.purchaseItem.findUnique({ where: { id: req.params.id } });
  await prisma.purchaseItem.delete({ where: { id: req.params.id } });
  await audit(req, { action: 'DELETE', entity: 'PurchaseItem', entityId: req.params.id, beforeData: before, description: '買取品明細 削除' });
  res.json({ ok: true });
});

/** 写真追加（forContract で契約書添付/社内専用を区別） */
router.post('/:id/photos', denyViewer, async (req, res) => {
  const schema = z.object({ url: z.string(), forContract: z.boolean().default(true) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const photo = await prisma.itemPhoto.create({
    data: { purchaseItemId: req.params.id, url: parsed.data.url, forContract: parsed.data.forContract },
  });
  res.status(201).json(photo);
});

router.delete('/photos/:photoId', denyViewer, async (req, res) => {
  await prisma.itemPhoto.delete({ where: { id: req.params.photoId } });
  res.json({ ok: true });
});

export default router;
