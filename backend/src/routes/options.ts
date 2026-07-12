import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();
router.use(authenticate);

// ---- 案件オプション（顧客費用・契約書表示） ----
const caseOptionSchema = z.object({
  caseId: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().default(1),
  amount: z.number().int().default(0),
  note: z.string().nullish(),
  showOnContract: z.boolean().default(true),
  deductible: z.boolean().default(true),
});

router.post('/case-options', denyViewer, async (req, res) => {
  const parsed = caseOptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const opt = await prisma.caseOption.create({ data: parsed.data });
  await audit(req, { action: 'AMOUNT_CHANGE', entity: 'CaseOption', entityId: opt.id, afterData: opt, description: '案件オプション追加' });
  res.status(201).json(opt);
});

router.put('/case-options/:id', denyViewer, async (req, res) => {
  const parsed = caseOptionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const opt = await prisma.caseOption.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(opt);
});

router.delete('/case-options/:id', denyViewer, async (req, res) => {
  await prisma.caseOption.delete({ where: { id: req.params.id } });
  await audit(req, { action: 'DELETE', entity: 'CaseOption', entityId: req.params.id, description: '案件オプション削除' });
  res.json({ ok: true });
});

// ---- 原価オプション（社内原価・顧客非表示） ----
const costOptionSchema = z.object({
  caseId: z.string(),
  name: z.string().min(1),
  subcontractor: z.string().nullish(),
  quantity: z.number().int().default(1),
  amount: z.number().int().default(0),
  note: z.string().nullish(),
});

// 自由入力された外注先を外注先マスタに自動登録（未登録なら）
async function registerSubcontractor(name?: string | null) {
  const n = name?.trim();
  if (!n) return;
  await (prisma as any).subcontractor.upsert({ where: { name: n }, create: { name: n }, update: { active: true } });
}

router.post('/cost-options', denyViewer, async (req, res) => {
  const parsed = costOptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await registerSubcontractor(parsed.data.subcontractor);
  const opt = await prisma.costOption.create({ data: parsed.data as any });
  await audit(req, { action: 'AMOUNT_CHANGE', entity: 'CostOption', entityId: opt.id, afterData: opt, description: '原価オプション追加' });
  res.status(201).json(opt);
});

router.put('/cost-options/:id', denyViewer, async (req, res) => {
  const parsed = costOptionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await registerSubcontractor(parsed.data.subcontractor);
  const opt = await prisma.costOption.update({ where: { id: req.params.id }, data: parsed.data as any });
  res.json(opt);
});

router.delete('/cost-options/:id', denyViewer, async (req, res) => {
  await prisma.costOption.delete({ where: { id: req.params.id } });
  await audit(req, { action: 'DELETE', entity: 'CostOption', entityId: req.params.id, description: '原価オプション削除' });
  res.json({ ok: true });
});

export default router;
