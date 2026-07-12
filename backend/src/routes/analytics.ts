import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { calcCaseTotals, calcSaleProfit } from '../services/finance';
import { getDefaultTaxRate, taxExcluded } from '../lib/tax';

const router = Router();
router.use(authenticate);

const round = (n: number) => Math.round(n);

/** 税込→表示用変換（taxMode=excluded なら税抜化） */
function conv(amount: number, rate: number, taxMode: string): number {
  return taxMode === 'excluded' ? taxExcluded(amount, rate) : amount;
}

/**
 * 買取分析
 * GET /api/analytics/purchase?from=&to=&groupBy=&taxMode=included|excluded
 * groupBy: appraiser | booker | customerType | referralSource | appointmentRank | date | none
 */
router.get('/purchase', async (req, res) => {
  const { from, to, groupBy = 'none', taxMode = 'included' } = req.query as Record<string, string>;
  const rate = await getDefaultTaxRate();

  const cases = await prisma.case.findMany({
    where: {
      createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59`) : undefined },
    },
    include: {
      customer: { select: { customerType: true } },
      appraiser: { select: { name: true } },
      booker: { select: { name: true } },
      purchaseItems: true,
      caseOptions: true,
      costOptions: true,
    },
  });

  const keyOf = (c: (typeof cases)[number]): string => {
    switch (groupBy) {
      case 'appraiser': return c.appraiser?.name ?? '未割当';
      case 'booker': return c.booker?.name ?? '未割当';
      case 'customerType': return c.customer.customerType === 'REPEATER' ? 'リピーター' : '新規';
      case 'referralSource': return c.referralSource ?? '未設定';
      case 'appointmentRank': return c.appointmentRank ?? '未設定';
      case 'date': return c.createdAt.toISOString().slice(0, 10);
      default: return '全体';
    }
  };

  const groups = new Map<string, any>();
  for (const c of cases) {
    const k = keyOf(c);
    if (!groups.has(k)) {
      groups.set(k, {
        key: k, inquiries: 0, appraisals: 0, closings: 0, repeaters: 0,
        purchaseTotal: 0, expectedTotal: 0, caseOptionTotal: 0, costOptionTotal: 0,
        expectedGrossProfit: 0, items: 0, caseIds: [] as string[],
      });
    }
    const g = groups.get(k);
    const t = calcCaseTotals(c.purchaseItems, c.caseOptions, c.costOptions);
    g.inquiries += 1;
    if (c.appraisalAt || ['APPRAISING', 'APPROVED', 'EXECUTED', 'COMPLETED'].includes(c.status)) g.appraisals += 1;
    if (c.status === 'COMPLETED') g.closings += 1;
    if (c.customer.customerType === 'REPEATER') g.repeaters += 1;
    g.purchaseTotal += conv(t.purchaseTotal, rate, taxMode);
    g.expectedTotal += conv(t.expectedTotal, rate, taxMode);
    g.caseOptionTotal += conv(t.caseOptionTotal, rate, taxMode);
    g.costOptionTotal += conv(t.costOptionTotal, rate, taxMode);
    g.expectedGrossProfit += conv(t.expectedGrossProfit, rate, taxMode);
    g.items += c.purchaseItems.filter((i) => !i.isLost).reduce((s, i) => s + i.quantity, 0);
    g.caseIds.push(c.id);
  }

  const rows = [...groups.values()].map((g) => {
    const denom = g.expectedTotal + g.caseOptionTotal;
    return {
      ...g,
      closingRate: g.inquiries > 0 ? round((g.closings / g.inquiries) * 1000) / 10 : 0,
      repeaterRate: g.inquiries > 0 ? round((g.repeaters / g.inquiries) * 1000) / 10 : 0,
      expectedCostRate: denom > 0 ? round(((g.purchaseTotal + g.costOptionTotal) / denom) * 1000) / 10 : 0,
      avgItems: g.inquiries > 0 ? round((g.items / g.inquiries) * 10) / 10 : 0,
    };
  });

  res.json({ taxMode, groupBy, rows });
});

/**
 * 販売分析
 * GET /api/analytics/sales?from=&to=&groupBy=&taxMode=&dateBase=sold|paid|contract
 */
router.get('/sales', async (req, res) => {
  const { from, to, groupBy = 'none', taxMode = 'included', dateBase = 'sold' } = req.query as Record<string, string>;
  const rate = await getDefaultTaxRate();
  // 在庫に設定された担当者名を引くためのマップ
  const userList = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(userList.map((u) => [u.id, u.name]));
  const fromD = from ? new Date(from) : null;
  const toD = to ? new Date(`${to}T23:59:59`) : null;

  const sales = await prisma.sale.findMany({
    include: {
      inventory: {
        include: {
          sourceCase: {
            include: {
              customer: { select: { customerType: true } },
              appraiser: { select: { name: true } },
              booker: { select: { name: true } },
              caseOptions: true,
              costOptions: true,
            },
          },
        },
      },
    },
  });

  const inRange = (s: (typeof sales)[number]): boolean => {
    let d: Date | null = null;
    if (dateBase === 'paid') d = s.paidDate;
    else if (dateBase === 'contract') d = s.inventory.sourceCase?.contractAt ?? null;
    else d = s.soldDate;
    if (!d) return false;
    if (fromD && d < fromD) return false;
    if (toD && d > toD) return false;
    return true;
  };

  const filtered = sales.filter(inRange);

  const keyOf = (s: (typeof sales)[number]): string => {
    const sc = s.inventory.sourceCase;
    switch (groupBy) {
      // 在庫に設定された買取担当を優先し、無ければ元案件の担当を使う
      case 'appraiser': return (s.inventory.appraiserId && userName.get(s.inventory.appraiserId)) || sc?.appraiser?.name || '未割当';
      case 'booker': return (s.inventory.bookerId && userName.get(s.inventory.bookerId)) || sc?.booker?.name || '未割当';
      case 'customerType': return sc?.customer?.customerType === 'REPEATER' ? 'リピーター' : '新規';
      case 'referralSource': return sc?.referralSource ?? '未設定';
      case 'appointmentRank': return sc?.appointmentRank ?? '未設定';
      case 'channel': return s.salesChannel ?? s.inventory.salesChannel ?? '未設定';
      case 'grade': return s.inventory.grade;
      case 'inventoryStatus': return s.inventory.status;
      case 'date': return s.soldDate.toISOString().slice(0, 10);
      default: return '全体';
    }
  };

  const groups = new Map<string, any>();
  for (const s of filtered) {
    const k = keyOf(s);
    if (!groups.has(k)) {
      groups.set(k, {
        key: k, count: 0, realRevenue: 0, purchaseTotal: 0, caseOptionTotal: 0, costOptionTotal: 0,
        realGrossProfit: 0, paidGrossProfit: 0, contractPurchase: 0, saleIds: [] as string[], inventoryIds: [] as string[],
      });
    }
    const g = groups.get(k);
    const sc = s.inventory.sourceCase;
    const caseOpt = sc?.caseOptions?.reduce((a, o) => a + o.amount, 0) ?? 0;
    const costOpt = (sc?.costOptions?.reduce((a, o) => a + o.amount, 0) ?? 0) + s.fee + s.shipping + s.otherCost;
    const profit = calcSaleProfit(s.salesAmount, s.inventory.purchaseAmount, caseOpt, costOpt);
    g.count += 1;
    g.realRevenue += conv(profit.realRevenue, rate, taxMode);
    g.purchaseTotal += conv(s.inventory.purchaseAmount, rate, taxMode);
    g.caseOptionTotal += conv(caseOpt, rate, taxMode);
    g.costOptionTotal += conv(costOpt, rate, taxMode);
    g.realGrossProfit += conv(profit.realGrossProfit, rate, taxMode);
    if (s.paidDate) g.paidGrossProfit += conv(profit.realGrossProfit, rate, taxMode);
    g.contractPurchase += conv(s.inventory.purchaseAmount, rate, taxMode);
    g.saleIds.push(s.id);
    g.inventoryIds.push(s.inventoryId);
  }

  const rows = [...groups.values()].map((g) => {
    const denom = g.realRevenue + g.caseOptionTotal;
    return {
      ...g,
      costRate: denom > 0 ? round(((g.purchaseTotal + g.costOptionTotal) / denom) * 1000) / 10 : 0,
    };
  });

  res.json({ taxMode, groupBy, dateBase, rows });
});

/**
 * 入出金レポート（差し引き前の総額）
 * GET /api/analytics/cashflow?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 現金精算(Settlement)と振込(Payment)を「支払（当社→顧客）」「受取（顧客→当社）」で
 * ネットせず総額集計する。例：Aへ1万円支払い、Aから2万円受取 → 支払1万・受取2万として計上。
 */
router.get('/cashflow', async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const fromD = from ? new Date(from) : null;
  const toD = to ? new Date(`${to}T23:59:59`) : null;
  const inRange = (d: Date | null | undefined) => {
    if (!d) return false;
    if (fromD && d < fromD) return false;
    if (toD && d > toD) return false;
    return true;
  };

  type Kind = '現金支払' | '現金受取' | '振込支払' | '振込受取';
  type Tx = { date: string; caseNumber: string; customer: string; kind: Kind; amount: number };
  const txs: Tx[] = [];

  // 振込（実行済のみ・実行日で判定）
  const payments = await prisma.payment.findMany({
    where: { status: 'COMPLETED' },
    include: { case: { include: { customer: { select: { name: true } } } } },
  });
  for (const p of payments) {
    if (!inRange(p.executedDate)) continue;
    txs.push({
      date: p.executedDate!.toISOString().slice(0, 10),
      caseNumber: p.case.caseNumber,
      customer: p.case.customer?.name ?? '',
      kind: p.direction === 'WITHDRAWAL' ? '振込支払' : '振込受取',
      amount: p.amount,
    });
  }

  // 現金精算（取引日＝案件の契約日→作業日→精算更新日）
  const settlements = await prisma.settlement.findMany({
    include: { case: { include: { customer: { select: { name: true } } } } },
  });
  for (const s of settlements) {
    const d = s.case.contractAt ?? s.case.workAt ?? s.updatedAt;
    if (!inRange(d)) continue;
    const dateStr = d.toISOString().slice(0, 10);
    const base = { date: dateStr, caseNumber: s.case.caseNumber, customer: s.case.customer?.name ?? '' };
    if (s.cashPaid > 0) txs.push({ ...base, kind: '現金支払', amount: s.cashPaid });
    if (s.cashReceived > 0) txs.push({ ...base, kind: '現金受取', amount: s.cashReceived });
  }

  txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 新しい順

  const sum = (k: Kind) => txs.filter((t) => t.kind === k).reduce((a, t) => a + t.amount, 0);
  const summary = {
    paidCash: sum('現金支払'),
    paidTransfer: sum('振込支払'),
    receivedCash: sum('現金受取'),
    receivedTransfer: sum('振込受取'),
  };
  const totals = {
    paid: summary.paidCash + summary.paidTransfer,
    received: summary.receivedCash + summary.receivedTransfer,
  };
  res.json({ summary, totals, transactions: txs });
});

export default router;
