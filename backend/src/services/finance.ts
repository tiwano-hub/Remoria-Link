import { CaseOption, CostOption, PurchaseItem } from '@prisma/client';

/**
 * 案件の金額集計・粗利計算。
 * 失点明細は買取金額・見込金額・粗利・在庫いずれにも反映しない（記録は残る）。
 */

export interface CaseTotals {
  purchaseTotal: number; // 買取金額合計（失点除く）
  expectedTotal: number; // 見込金額合計（失点除く）
  caseOptionTotal: number; // 案件オプション合計
  costOptionTotal: number; // 原価オプション合計
  expectedGrossProfit: number; // 見込粗利
  expectedCostRate: number; // 見込原価率(%)
  customerPayable: number; // 顧客への支払額（差引後）
}

export function calcCaseTotals(
  items: Pick<PurchaseItem, 'purchaseAmount' | 'expectedAmount' | 'isLost'>[],
  caseOptions: Pick<CaseOption, 'amount' | 'deductible'>[],
  costOptions: Pick<CostOption, 'amount'>[],
): CaseTotals {
  const active = items.filter((i) => !i.isLost);
  const purchaseTotal = active.reduce((s, i) => s + i.purchaseAmount, 0);
  const expectedTotal = active.reduce((s, i) => s + i.expectedAmount, 0);
  const caseOptionTotal = caseOptions.reduce((s, o) => s + o.amount, 0);
  const costOptionTotal = costOptions.reduce((s, o) => s + o.amount, 0);

  // 見込粗利 ＝ 見込金額合計 ＋ 案件オプション金額 － 買取金額 － 原価オプション金額
  const expectedGrossProfit =
    expectedTotal + caseOptionTotal - purchaseTotal - costOptionTotal;

  // 見込原価率 ＝（買取金額 ＋ 原価オプション金額）÷（見込金額 ＋ 案件オプション金額）×100
  const denom = expectedTotal + caseOptionTotal;
  const expectedCostRate =
    denom > 0 ? ((purchaseTotal + costOptionTotal) / denom) * 100 : 0;

  // 顧客への支払額：買取金額 － 差引対象の案件オプション
  const deductibleOptions = caseOptions
    .filter((o) => o.deductible)
    .reduce((s, o) => s + o.amount, 0);
  const customerPayable = purchaseTotal - deductibleOptions;

  return {
    purchaseTotal,
    expectedTotal,
    caseOptionTotal,
    costOptionTotal,
    expectedGrossProfit,
    expectedCostRate: Math.round(expectedCostRate * 10) / 10,
    customerPayable,
  };
}

export interface SaleProfit {
  realRevenue: number; // 実売上（税込）
  realGrossProfit: number; // 実粗利
  costRate: number; // 原価率(%)
}

/**
 * 実粗利 ＝ 実売上 ＋ 案件オプション金額 － 買取金額 － 原価オプション金額
 * 原価率 ＝（買取金額 ＋ 原価オプション金額）÷（実売上 ＋ 案件オプション金額）×100
 */
export function calcSaleProfit(
  salesAmount: number,
  purchaseAmount: number,
  caseOptionAmount: number,
  costOptionAmount: number,
): SaleProfit {
  const realRevenue = salesAmount;
  const realGrossProfit =
    realRevenue + caseOptionAmount - purchaseAmount - costOptionAmount;
  const denom = realRevenue + caseOptionAmount;
  const costRate =
    denom > 0 ? ((purchaseAmount + costOptionAmount) / denom) * 100 : 0;
  return {
    realRevenue,
    realGrossProfit,
    costRate: Math.round(costRate * 10) / 10,
  };
}
