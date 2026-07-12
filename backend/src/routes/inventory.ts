import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';
import { nextInventoryNumber } from '../lib/numbering';

const router = Router();
router.use(authenticate);

async function resolveStoreCode(storeId?: string | null): Promise<string> {
  if (storeId) {
    const s = await prisma.store.findUnique({ where: { id: storeId } });
    if (s) return s.code;
  }
  const first = await prisma.store.findFirst({ where: { active: true } });
  return first?.code ?? 'STORE';
}

/** 案件の買取明細から在庫を自動登録（失点・グレード/販路未設定はスキップ） */
router.post('/from-case/:caseId', denyViewer, async (req, res) => {
  const c = await prisma.case.findUnique({
    where: { id: req.params.caseId },
    include: { purchaseItems: true, store: true, appraiser: true, booker: true },
  });
  if (!c) return res.status(404).json({ error: '案件が見つかりません' });

  const storeCode = await resolveStoreCode(c.storeId);
  const created = [];
  for (const item of c.purchaseItems) {
    if (item.isLost) continue; // 失点は在庫登録しない
    if (!item.salesChannel || item.grade === 'NONE') continue; // グレード・販路必須
    // 既に在庫化済みかチェック
    const exists = await prisma.inventoryItem.findFirst({ where: { sourceItemId: item.id } });
    if (exists) continue;

    const inventoryNumber = await nextInventoryNumber(storeCode);
    const inv = await prisma.inventoryItem.create({
      data: {
        inventoryNumber,
        storeId: c.storeId,
        name: item.name,
        quantity: item.quantity,
        grade: item.grade,
        purchaseAmount: item.purchaseAmount,
        expectedAmount: item.expectedAmount,
        salesChannel: item.salesChannel,
        sourceCaseId: c.id,
        sourceItemId: item.id,
        stockedAt: c.contractAt ?? new Date(),
        appraiserId: c.appraiserId,
        bookerId: c.bookerId,
      },
    });
    await audit(req, {
      action: 'INVENTORY_REGISTER',
      caseNumber: c.caseNumber,
      entity: 'InventoryItem',
      entityId: inv.id,
      afterData: inv,
      description: `在庫自動登録 ${inventoryNumber}`,
    });
    created.push(inv);
  }
  res.json({ created });
});

const manualSchema = z.object({
  storeId: z.string().nullish(),
  name: z.string().min(1),
  quantity: z.number().int().default(1),
  grade: z.enum(['N', 'S', 'A', 'B', 'C', 'D', 'E', 'J', 'NONE']),
  purchaseAmount: z.number().int().default(0),
  expectedAmount: z.number().int().default(0),
  salesChannel: z.string().min(1),
  storageLocation: z.string().nullish(),
  note: z.string().nullish(),
  appraiserId: z.string().nullish(),
});

/** 在庫個別登録 */
router.post('/', denyViewer, async (req, res) => {
  const parsed = manualSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const storeCode = await resolveStoreCode(parsed.data.storeId);
  const inventoryNumber = await nextInventoryNumber(storeCode);
  const inv = await prisma.inventoryItem.create({
    data: {
      inventoryNumber,
      storeId: parsed.data.storeId ?? undefined,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      grade: parsed.data.grade,
      purchaseAmount: parsed.data.purchaseAmount,
      expectedAmount: parsed.data.expectedAmount,
      salesChannel: parsed.data.salesChannel,
      storageLocation: parsed.data.storageLocation ?? undefined,
      note: parsed.data.note ?? undefined,
      appraiserId: parsed.data.appraiserId ?? undefined,
    },
  });
  await audit(req, {
    action: 'INVENTORY_REGISTER',
    entity: 'InventoryItem',
    entityId: inv.id,
    afterData: inv,
    description: `在庫個別登録 ${inventoryNumber}`,
  });
  res.status(201).json(inv);
});

/** 在庫検索 */
router.get('/', async (req, res) => {
  const { inventoryNumber, name, grade, salesChannel, status, stockedFrom, stockedTo, appraiserId, caseNumber, includeClosed } =
    req.query as Record<string, string>;
  // ステータス条件：明示指定があればそれ。無ければ既定で「売却済・廃棄」を除外
  // （includeClosed=true のときは除外しない）
  const statusWhere = status
    ? (status as any)
    : includeClosed === 'true'
      ? undefined
      : { notIn: ['SOLD', 'DISPOSED'] as any };
  const list = await prisma.inventoryItem.findMany({
    where: {
      inventoryNumber: inventoryNumber ? { contains: inventoryNumber } : undefined,
      name: name ? { contains: name } : undefined,
      grade: grade ? (grade as any) : undefined,
      salesChannel: salesChannel ? { contains: salesChannel } : undefined,
      status: statusWhere,
      appraiserId: appraiserId || undefined,
      stockedAt: {
        gte: stockedFrom ? new Date(stockedFrom) : undefined,
        lte: stockedTo ? new Date(`${stockedTo}T23:59:59`) : undefined,
      },
      sourceCase: caseNumber ? { caseNumber: { contains: caseNumber } } : undefined,
    },
    include: { sourceCase: { select: { caseNumber: true } }, sales: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  res.json(list);
});

router.get('/:id', async (req, res) => {
  const inv = await prisma.inventoryItem.findUnique({
    where: { id: req.params.id },
    include: {
      photos: true,
      sales: true,
      sourceCase: { include: { customer: { select: { name: true } } } },
    },
  });
  if (!inv) return res.status(404).json({ error: '在庫が見つかりません' });
  res.json(inv);
});

router.put('/:id', denyViewer, async (req, res) => {
  const schema = manualSchema.partial().extend({
    status: z.enum(['IN_STOCK', 'LISTED', 'SOLD', 'DISPOSED', 'RETURNED', 'ON_HOLD']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: any = { ...parsed.data };
  delete data.storeId;
  // 買取担当者(appraiserId)の変更は管理者のみ
  if ('appraiserId' in data && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: '買取担当者を変更できるのは管理者のみです' });
  }
  const inv = await prisma.inventoryItem.update({ where: { id: req.params.id }, data });
  res.json(inv);
});

router.post('/:id/photos', denyViewer, async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: 'url が必要です' });
  const photo = await prisma.inventoryPhoto.create({ data: { inventoryId: req.params.id, url } });
  res.status(201).json(photo);
});

export default router;
