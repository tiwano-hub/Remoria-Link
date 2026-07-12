import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { clearTaxCache } from '../lib/tax';

const router = Router();
router.use(authenticate);

const manage = requireRole('ADMIN', 'STORE_MANAGER');

/** 全マスタをまとめて取得（フォームの選択肢用） */
router.get('/', async (_req, res) => {
  const [taxRates, channels, sources, locations, stores, subcontractors] = await Promise.all([
    prisma.taxRate.findMany({ orderBy: { effectiveFrom: 'desc' } }),
    prisma.salesChannel.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.referralSource.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.storageLocation.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.store.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    (prisma as any).subcontractor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);
  res.json({ taxRates, channels, sources, locations, stores, subcontractors });
});

// ---- 税率 ----
router.post('/tax-rates', manage, async (req, res) => {
  const schema = z.object({
    rate: z.number().min(0).max(1),
    label: z.string(),
    effectiveFrom: z.string(),
    isDefault: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.isDefault) {
    await prisma.taxRate.updateMany({ data: { isDefault: false } });
  }
  const created = await prisma.taxRate.create({
    data: { ...parsed.data, effectiveFrom: new Date(parsed.data.effectiveFrom) },
  });
  clearTaxCache();
  res.status(201).json(created);
});

// ---- 汎用マスタ（販路・反響経路・保管場所） ----
function simpleMaster(model: 'salesChannel' | 'referralSource' | 'storageLocation' | 'subcontractor') {
  const r = Router();
  r.post('/', manage, async (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name) return res.status(400).json({ error: 'name が必要です' });
    const created = await (prisma as any)[model].create({ data: { name } });
    res.status(201).json(created);
  });
  r.delete('/:id', manage, async (req, res) => {
    await (prisma as any)[model].update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ ok: true });
  });
  return r;
}

router.use('/channels', simpleMaster('salesChannel'));
router.use('/sources', simpleMaster('referralSource'));
router.use('/locations', simpleMaster('storageLocation'));
router.use('/subcontractors', simpleMaster('subcontractor'));

// ---- 店舗 ----
router.post('/stores', manage, async (req, res) => {
  const schema = z.object({ code: z.string().min(1), name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const created = await prisma.store.create({ data: parsed.data });
  res.status(201).json(created);
});

export default router;
