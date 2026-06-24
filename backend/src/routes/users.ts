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

export default router;
