import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** 操作ログ閲覧（管理者・店舗責任者） */
router.get('/', requireRole('ADMIN', 'STORE_MANAGER'), async (req, res) => {
  const { caseNumber, action, userId } = req.query as Record<string, string>;
  const logs = await prisma.auditLog.findMany({
    where: {
      caseNumber: caseNumber ? { contains: caseNumber } : undefined,
      action: action ? (action as any) : undefined,
      userId: userId || undefined,
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(logs);
});

export default router;
