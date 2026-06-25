import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { nextCaseNumber } from '../lib/numbering';
import { audit } from '../services/audit';
import { calcCaseTotals } from '../services/finance';
import { syncCaseCalendar } from '../services/caseCalendarSync';
import { getDefaultTaxRate, breakdown } from '../lib/tax';

const router = Router();
router.use(authenticate);

const customerInput = z.object({
  name: z.string().optional(),
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
});

const caseFields = z.object({
  bookerId: z.string().nullish(),
  appraiserId: z.string().nullish(),
  workerId: z.string().nullish(),
  reservedAt: z.string().nullish(),
  appraisalAt: z.string().nullish(),
  workAt: z.string().nullish(),
  contractAt: z.string().nullish(),
  appraisalHours: z.number().nullish(),
  workHours: z.number().nullish(),
  status: z
    .enum(['INQUIRY', 'RESERVED', 'APPRAISING', 'APPROVED', 'EXECUTED', 'COMPLETED', 'CONSIDERING', 'CANCELLED'])
    .optional(),
  purchaseMethod: z.enum(['VISIT', 'DELIVERY', 'STORE']).nullish(),
  referralSource: z.string().nullish(),
  appointmentRank: z.enum(['A', 'B', 'C', 'D', 'E', 'F']).nullish(),
  internalMemo: z.string().nullish(),
  customerMessage: z.string().nullish(),
  storeId: z.string().nullish(),
});

const toDate = (v: string | null | undefined) => (v ? new Date(v) : null);

/** POST /api/cases  電話番号起点で顧客を upsert し案件を作成 */
router.post('/', denyViewer, async (req, res) => {
  const schema = z.object({ customer: customerInput, case: caseFields.optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const phone = parsed.data.customer.phone.replace(/[^0-9]/g, '');
  const existing = await prisma.customer.findUnique({ where: { phone } });

  const ci = parsed.data.customer;
  const fullName = [ci.lastName, ci.firstName].filter(Boolean).join(' ') || ci.name;
  if (!fullName) return res.status(400).json({ error: '顧客名（姓）を入力してください' });

  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: { ...ci, name: fullName, phone, customerType: 'REPEATER' },
      })
    : await prisma.customer.create({
        data: { ...ci, name: fullName, phone, customerType: 'NEW' },
      });

  const caseNumber = await nextCaseNumber();
  const cf = parsed.data.case || {};
  const created = await prisma.case.create({
    data: {
      caseNumber,
      customerId: customer.id,
      storeId: cf.storeId ?? req.user!.storeId ?? undefined,
      bookerId: cf.bookerId ?? undefined,
      appraiserId: cf.appraiserId ?? undefined,
      workerId: cf.workerId ?? undefined,
      reservedAt: toDate(cf.reservedAt),
      appraisalAt: toDate(cf.appraisalAt),
      workAt: toDate(cf.workAt),
      contractAt: toDate(cf.contractAt),
      appraisalHours: cf.appraisalHours ?? undefined,
      workHours: cf.workHours ?? undefined,
      status: cf.status ?? 'INQUIRY',
      purchaseMethod: cf.purchaseMethod ?? undefined,
      referralSource: cf.referralSource ?? undefined,
      appointmentRank: cf.appointmentRank ?? undefined,
      internalMemo: cf.internalMemo ?? undefined,
      customerMessage: cf.customerMessage ?? undefined,
    },
  });

  await audit(req, {
    action: 'CASE_CREATE',
    caseNumber,
    entity: 'Case',
    entityId: created.id,
    afterData: created,
    description: `案件作成 ${caseNumber}`,
  });
  await syncCaseCalendar(created.id);

  res.status(201).json(created);
});

/** GET /api/cases  一覧（検索・フィルタ） */
router.get('/', async (req, res) => {
  const { status, q, appraiserId, bookerId } = req.query as Record<string, string>;
  const cases = await prisma.case.findMany({
    where: {
      status: status ? (status as any) : undefined,
      appraiserId: appraiserId || undefined,
      bookerId: bookerId || undefined,
      OR: q
        ? [
            { caseNumber: { contains: q } },
            { customer: { name: { contains: q } } },
            { customer: { phone: { contains: q } } },
          ]
        : undefined,
    },
    include: {
      customer: { select: { name: true, phone: true } },
      appraiser: { select: { name: true } },
      booker: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(cases);
});

async function loadCaseDetail(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      customer: true,
      booker: { select: { id: true, name: true } },
      appraiser: { select: { id: true, name: true } },
      worker: { select: { id: true, name: true } },
      purchaseItems: { include: { photos: true }, orderBy: { createdAt: 'asc' } },
      caseOptions: { orderBy: { createdAt: 'asc' } },
      costOptions: { orderBy: { createdAt: 'asc' } },
      contracts: { include: { signature: true }, orderBy: { createdAt: 'desc' } },
      identity: true,
      receipts: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      settlement: true,
      inventory: true,
    },
  });
}

/** GET /api/cases/:id  詳細＋粗利集計 */
router.get('/:id', async (req, res) => {
  const c = await loadCaseDetail(req.params.id);
  if (!c) return res.status(404).json({ error: '案件が見つかりません' });
  const rate = await getDefaultTaxRate();
  const totals = calcCaseTotals(c.purchaseItems, c.caseOptions, c.costOptions);
  res.json({
    ...c,
    totals: {
      ...totals,
      tax: {
        purchase: breakdown(totals.purchaseTotal, rate),
        expected: breakdown(totals.expectedTotal, rate),
      },
    },
  });
});

/** PUT /api/cases/:id  更新（カレンダー同期付き） */
router.put('/:id', denyViewer, async (req, res) => {
  const parsed = caseFields.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const before = await prisma.case.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: '案件が見つかりません' });

  const cf = parsed.data;
  const updated = await prisma.case.update({
    where: { id: req.params.id },
    data: {
      bookerId: cf.bookerId === undefined ? undefined : cf.bookerId,
      appraiserId: cf.appraiserId === undefined ? undefined : cf.appraiserId,
      workerId: cf.workerId === undefined ? undefined : cf.workerId,
      reservedAt: cf.reservedAt === undefined ? undefined : toDate(cf.reservedAt),
      appraisalAt: cf.appraisalAt === undefined ? undefined : toDate(cf.appraisalAt),
      workAt: cf.workAt === undefined ? undefined : toDate(cf.workAt),
      contractAt: cf.contractAt === undefined ? undefined : toDate(cf.contractAt),
      appraisalHours: cf.appraisalHours === undefined ? undefined : cf.appraisalHours,
      workHours: cf.workHours === undefined ? undefined : cf.workHours,
      status: cf.status,
      purchaseMethod: cf.purchaseMethod === undefined ? undefined : cf.purchaseMethod,
      referralSource: cf.referralSource === undefined ? undefined : cf.referralSource,
      appointmentRank: cf.appointmentRank === undefined ? undefined : cf.appointmentRank,
      internalMemo: cf.internalMemo === undefined ? undefined : cf.internalMemo,
      customerMessage: cf.customerMessage === undefined ? undefined : cf.customerMessage,
      storeId: cf.storeId === undefined ? undefined : cf.storeId,
    },
  });

  await audit(req, {
    action: 'CASE_UPDATE',
    caseNumber: before.caseNumber,
    entity: 'Case',
    entityId: before.id,
    beforeData: before,
    afterData: updated,
    description: `案件更新 ${before.caseNumber}`,
  });
  await syncCaseCalendar(updated.id);

  res.json(updated);
});

export default router;
