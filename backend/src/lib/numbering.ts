import { prisma } from './prisma';

/** YYYYMMDD 形式（JST） */
export function ymd(date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** カウンタをアトミックにインクリメントして次の値を返す */
async function nextSeq(key: string): Promise<number> {
  const rec = await prisma.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return rec.value;
}

/** 案件番号 例: C-20260624-0001 */
export async function nextCaseNumber(date = new Date()): Promise<string> {
  const day = ymd(date);
  const seq = await nextSeq(`case-${day}`);
  return `C-${day}-${String(seq).padStart(4, '0')}`;
}

/** 在庫番号 例: KOBE-20260624-0001 */
export async function nextInventoryNumber(storeCode: string, date = new Date()): Promise<string> {
  const day = ymd(date);
  const seq = await nextSeq(`inv-${storeCode}-${day}`);
  return `${storeCode}-${day}-${String(seq).padStart(4, '0')}`;
}

/** 領収書番号 例: R-20260624-0001 */
export async function nextReceiptNumber(date = new Date()): Promise<string> {
  const day = ymd(date);
  const seq = await nextSeq(`receipt-${day}`);
  return `R-${day}-${String(seq).padStart(4, '0')}`;
}
