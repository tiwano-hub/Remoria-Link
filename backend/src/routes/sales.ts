import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, denyViewer } from '../middleware/auth';
import { audit } from '../services/audit';
import { calcSaleProfit } from '../services/finance';

const router = Router();
router.use(authenticate);

const schema = z.object({
  inventoryId: z.string(),
  soldDate: z.string(),
  paidDate: z.string().nullish(),
  salesAmount: z.number().int(),
  fee: z.number().int().default(0),
  shipping: z.number().int().default(0),
  otherCost: z.number().int().default(0),
  salesChannel: z.string().nullish(),
  buyer: z.string().nullish(),
  note: z.string().nullish(),
});

/** 販売登録。登録後、在庫ステータスを自動で SOLD に変更。 */
router.post('/', denyViewer, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const inv = await prisma.inventoryItem.findUnique({ where: { id: parsed.data.inventoryId } });
  if (!inv) return res.status(404).json({ error: '在庫が見つかりません' });

  const result = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        inventoryId: parsed.data.inventoryId,
        soldDate: new Date(parsed.data.soldDate),
        paidDate: parsed.data.paidDate ? new Date(parsed.data.paidDate) : null,
        salesAmount: parsed.data.salesAmount,
        fee: parsed.data.fee,
        shipping: parsed.data.shipping,
        otherCost: parsed.data.otherCost,
        salesChannel: parsed.data.salesChannel ?? inv.salesChannel,
        buyer: parsed.data.buyer ?? undefined,
        note: parsed.data.note ?? undefined,
      },
    });
    await tx.inventoryItem.update({
      where: { id: inv.id },
      data: { status: 'SOLD' },
    });
    return sale;
  });

  await audit(req, {
    action: 'SALE_REGISTER',
    entity: 'Sale',
    entityId: result.id,
    afterData: result,
    description: `販売登録 ${inv.inventoryNumber}`,
  });
  res.status(201).json(result);
});

function enrich(sale: any) {
  const inv = sale.inventory;
  const otherCost = sale.fee + sale.shipping + sale.otherCost;
  const profit = calcSaleProfit(sale.salesAmount, inv.purchaseAmount, 0, otherCost);
  return {
    id: sale.id,
    soldDate: sale.soldDate,
    paidDate: sale.paidDate,
    inventoryNumber: inv.inventoryNumber,
    inventoryId: inv.id,
    name: inv.name,
    grade: inv.grade,
    purchaseAmount: inv.purchaseAmount,
    salesAmount: sale.salesAmount,
    realGrossProfit: profit.realGrossProfit,
    costRate: profit.costRate,
    salesChannel: sale.salesChannel,
    buyer: sale.buyer,
    appraiserId: inv.appraiserId,
    bookerId: inv.bookerId,
    sourceCaseId: inv.sourceCaseId,
    sourceCaseNumber: inv.sourceCase?.caseNumber,
    customerName: inv.sourceCase?.customer?.name,
    status: sale.status,
    note: sale.note,
  };
}

/** 販売実績一覧（検索） */
router.get('/', async (req, res) => {
  const { soldFrom, soldTo, paidFrom, paidTo, inventoryNumber, name, grade, salesChannel, appraiserId, bookerId, caseNumber, minAmount, maxAmount, status } =
    req.query as Record<string, string>;

  const sales = await prisma.sale.findMany({
    where: {
      soldDate: { gte: soldFrom ? new Date(soldFrom) : undefined, lte: soldTo ? new Date(`${soldTo}T23:59:59`) : undefined },
      paidDate: paidFrom || paidTo ? { gte: paidFrom ? new Date(paidFrom) : undefined, lte: paidTo ? new Date(`${paidTo}T23:59:59`) : undefined } : undefined,
      salesAmount: { gte: minAmount ? Number(minAmount) : undefined, lte: maxAmount ? Number(maxAmount) : undefined },
      status: status ? (status as any) : undefined,
      salesChannel: salesChannel ? { contains: salesChannel } : undefined,
      inventory: {
        inventoryNumber: inventoryNumber ? { contains: inventoryNumber } : undefined,
        name: name ? { contains: name } : undefined,
        grade: grade ? (grade as any) : undefined,
        appraiserId: appraiserId || undefined,
        bookerId: bookerId || undefined,
        sourceCase: caseNumber ? { caseNumber: { contains: caseNumber } } : undefined,
      },
    },
    include: {
      inventory: {
        include: { sourceCase: { include: { customer: { select: { name: true } } } } },
      },
    },
    orderBy: { soldDate: 'desc' },
    take: 500,
  });
  res.json(sales.map(enrich));
});

/** CSV 出力 */
router.get('/csv', async (req, res) => {
  const sales = await prisma.sale.findMany({
    include: { inventory: { include: { sourceCase: { include: { customer: { select: { name: true } } } } } } },
    orderBy: { soldDate: 'desc' },
  });
  const rows = sales.map(enrich);
  const header = [
    '販売日', '入金日', '在庫番号', '商品名', 'グレード', '買取金額', '販売金額', '実粗利', '原価率', '販路', '販売先', '元案件番号', '顧客名', 'ステータス',
  ];
  const csv = [header.join(',')]
    .concat(
      rows.map((r) =>
        [
          r.soldDate ? new Date(r.soldDate).toISOString().slice(0, 10) : '',
          r.paidDate ? new Date(r.paidDate).toISOString().slice(0, 10) : '',
          r.inventoryNumber, `"${r.name}"`, r.grade, r.purchaseAmount, r.salesAmount, r.realGrossProfit, r.costRate, r.salesChannel ?? '', r.buyer ?? '', r.sourceCaseNumber ?? '', r.customerName ?? '', r.status,
        ].join(','),
      ),
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sales.csv"');
  res.send('﻿' + csv); // BOM for Excel
});

export default router;
