import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/customers/lookup?phone=...
 * 電話番号で既存顧客を検索。一致すれば顧客情報と過去案件履歴を返す。
 */
router.get('/lookup', async (req, res) => {
  const phone = String(req.query.phone || '').replace(/[^0-9]/g, '');
  if (!phone) return res.status(400).json({ error: '電話番号を入力してください' });

  const customer = await prisma.customer.findFirst({
    where: { phone: { contains: phone } },
    include: {
      cases: {
        orderBy: { createdAt: 'desc' },
        include: {
          appraiser: { select: { name: true } },
          worker: { select: { name: true } },
          purchaseItems: { where: { isLost: false } },
          caseOptions: true,
        },
      },
    },
  });

  if (!customer) return res.json({ found: false });

  const history = customer.cases.map((c) => {
    const purchaseTotal = c.purchaseItems.reduce((s, i) => s + i.purchaseAmount, 0);
    const workFee = c.caseOptions.reduce((s, o) => s + o.amount, 0);
    return {
      id: c.id,
      caseNumber: c.caseNumber,
      date: c.contractAt || c.appraisalAt || c.createdAt,
      status: c.status,
      items: c.purchaseItems.map((i) => i.name),
      purchaseTotal,
      workFee,
      closed: c.status === 'COMPLETED', // 成約/不成約の目安
      appraiser: c.appraiser?.name,
    };
  });

  res.json({
    found: true,
    customer: {
      id: customer.id,
      name: customer.name,
      nameKana: customer.nameKana,
      phone: customer.phone,
      email: customer.email,
      postalCode: customer.postalCode,
      prefecture: customer.prefecture,
      city: customer.city,
      address: customer.address,
      building: customer.building,
      customerType: 'REPEATER', // 既存顧客はリピーター扱い
    },
    history,
  });
});

router.get('/', async (req, res) => {
  const q = String(req.query.q || '');
  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { nameKana: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  res.json(customers);
});

router.get('/:id', async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: { cases: { orderBy: { createdAt: 'desc' } } },
  });
  if (!customer) return res.status(404).json({ error: '顧客が見つかりません' });
  res.json(customer);
});

const customerSchema = z.object({
  name: z.string().min(1),
  lastName: z.string().optional(),
  firstName: z.string().optional(),
  nameKana: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().optional(),
  postalCode: z.string().optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  building: z.string().optional(),
  customerType: z.enum(['NEW', 'REPEATER']).optional(),
  note: z.string().optional(),
});

router.put('/:id', denyViewer, async (req, res) => {
  const parsed = customerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  // 姓・名のどちらかが更新されたら、結合した name を作り直す
  if (data.lastName !== undefined || data.firstName !== undefined) {
    const existing: any = await prisma.customer.findUnique({ where: { id: req.params.id } });
    const ln = data.lastName !== undefined ? data.lastName : existing?.lastName;
    const fn = data.firstName !== undefined ? data.firstName : existing?.firstName;
    const full = [ln, fn].filter(Boolean).join(' ');
    if (full) data.name = full;
  }
  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data,
  });
  res.json(customer);
});

export default router;
