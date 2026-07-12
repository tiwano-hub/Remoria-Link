import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** ユーザー一覧（担当者選択にも利用するため全ロール閲覧可） */
router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { store: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

/** ユーザー追加は管理者のみ（このメールでログイン可能になる） */
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({
    email: z.string().email('メールアドレスの形式が正しくありません'),
    name: z.string().min(1, '氏名を入力してください'),
    role: z.enum(['ADMIN', 'STORE_MANAGER', 'APPRAISER', 'BOOKER', 'VIEWER']).default('VIEWER'),
    storeId: z.string().nullish(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const email = parsed.data.email.trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
  const user = await prisma.user.create({
    data: { email, name: parsed.data.name, role: parsed.data.role, storeId: parsed.data.storeId ?? undefined },
  });
  res.status(201).json(user);
});

/** 権限・状態変更は管理者のみ */
router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    role: z.enum(['ADMIN', 'STORE_MANAGER', 'APPRAISER', 'BOOKER', 'VIEWER']).optional(),
    active: z.boolean().optional(),
    storeId: z.string().nullish(),
    calendarId: z.string().nullish(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(user);
});

/** ユーザー削除は管理者のみ（自分自身・最後の管理者は不可） */
router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  if (req.user!.id === req.params.id) {
    return res.status(400).json({ error: '自分自身は削除できません' });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  if (target.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) return res.status(400).json({ error: '管理者が1人になるため削除できません' });
  }
  // 案件・ログの担当参照は自動的に空欄になる（ON DELETE SET NULL）
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
