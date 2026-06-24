import { prisma } from './prisma';

/**
 * 税計算ユーティリティ。
 * 入力金額はすべて「税込」。ここから税抜・消費税額を算出する。
 */

let cachedRate: number | null = null;
let cachedAt = 0;

export async function getDefaultTaxRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now - cachedAt < 60_000) return cachedRate;
  const rec = await prisma.taxRate.findFirst({
    where: { isDefault: true },
    orderBy: { effectiveFrom: 'desc' },
  });
  cachedRate = rec?.rate ?? 0.1;
  cachedAt = now;
  return cachedRate;
}

export function clearTaxCache() {
  cachedRate = null;
}

/** 税込金額から税抜金額を算出（円未満切り捨て） */
export function taxExcluded(taxIncluded: number, rate: number): number {
  return Math.floor(taxIncluded / (1 + rate));
}

/** 税込金額から消費税額を算出 */
export function taxAmount(taxIncluded: number, rate: number): number {
  return taxIncluded - taxExcluded(taxIncluded, rate);
}

export interface TaxBreakdown {
  included: number;
  excluded: number;
  tax: number;
  rate: number;
}

export function breakdown(taxIncluded: number, rate: number): TaxBreakdown {
  const excluded = taxExcluded(taxIncluded, rate);
  return { included: taxIncluded, excluded, tax: taxIncluded - excluded, rate };
}
