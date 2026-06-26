import { prisma } from '../lib/prisma';
import { calcCaseTotals } from './finance';

/**
 * 契約書スナップショットを構築する。
 * 顧客に見せてはいけない項目（見込金額・販路・原価オプション・粗利・社内メモ・
 * 社内専用写真・失点明細）は一切含めない。
 */
export interface ContractSnapshot {
  caseNumber: string;
  purchaseMethod: string | null;
  contractDate: string | null;
  customer: {
    name: string;
    nameKana: string | null;
    phone: string;
    address: string;
  };
  items: {
    name: string;
    quantity: number;
    grade: string;
    amount: number; // 買取金額（税込）
    note: string | null;
    photos: string[]; // 契約書添付写真のみ
  }[];
  caseOptions: { name: string; quantity: number; amount: number }[];
  purchaseTotal: number;
  optionTotal: number;
  payable: number; // 差引後支払額（マイナス=請求）
  customerMessage: string | null;
}

export async function buildContractSnapshot(caseId: string): Promise<ContractSnapshot | null> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      customer: true,
      purchaseItems: { include: { photos: true } },
      caseOptions: true,
      costOptions: true,
    },
  });
  if (!c) return null;

  const totals = calcCaseTotals(c.purchaseItems, c.caseOptions, c.costOptions);

  // 失点明細のみ除外（買取する明細は契約書に必ず記載＝金額計算と一致させる）
  const visibleItems = c.purchaseItems.filter((i) => !i.isLost);
  const visibleOptions = c.caseOptions.filter((o) => o.showOnContract);

  const address = [c.customer.postalCode ? `〒${c.customer.postalCode}` : '', c.customer.prefecture, c.customer.city, c.customer.address, c.customer.building]
    .filter(Boolean)
    .join(' ');

  return {
    caseNumber: c.caseNumber,
    purchaseMethod: c.purchaseMethod,
    contractDate: c.contractAt ? c.contractAt.toISOString().slice(0, 10) : null,
    customer: {
      name: c.customer.name,
      nameKana: c.customer.nameKana,
      phone: c.customer.phone,
      address,
    },
    items: visibleItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      grade: i.grade,
      amount: i.purchaseAmount, // 見込金額・販路は含めない
      note: i.note,
      photos: i.photos.filter((p) => p.forContract).map((p) => p.url), // 社内専用写真は除外
    })),
    caseOptions: visibleOptions.map((o) => ({ name: o.name, quantity: o.quantity, amount: o.amount })),
    purchaseTotal: totals.purchaseTotal,
    optionTotal: visibleOptions.reduce((s, o) => s + o.amount, 0),
    payable: totals.customerPayable,
    customerMessage: c.customerMessage,
  };
}
