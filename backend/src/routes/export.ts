import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import {
  CASE_STATUS_LABEL,
  PURCHASE_METHOD_LABEL,
  ROLE_LABEL,
  INVENTORY_STATUS_LABEL,
  PAYMENT_DIRECTION_LABEL,
  PAYMENT_STATUS_LABEL,
  SALE_STATUS_LABEL,
  RECEIPT_STATUS_LABEL,
  CUSTOMER_TYPE_LABEL,
  SETTLEMENT_METHOD_LABEL,
} from '../constants';

const router = Router();
router.use(authenticate);

type Col = { key: string; label: string };

const esc = (v: any) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function toCsv(rows: Record<string, any>[], cols: Col[]): string {
  const head = cols.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(',')).join('\n');
  return '﻿' + head + '\n' + body + '\n'; // 先頭にBOM（Excelの文字化け防止）
}

function send(res: Response, filename: string, rows: Record<string, any>[], cols: Col[]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(rows, cols));
}

// 日時を JST(YYYY-MM-DD HH:mm) で表示
const dt = (x?: Date | null) =>
  x ? new Date(new Date(x).getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '';
const date = (x?: Date | null) =>
  x ? new Date(new Date(x).getTime() + 9 * 3600000).toISOString().slice(0, 10) : '';

/** 案件 */
router.get('/cases.csv', async (_req, res) => {
  const data = await prisma.case.findMany({
    include: { customer: true, appraiser: true, worker: true, booker: true },
    orderBy: { createdAt: 'desc' },
  });
  const rows = data.map((c) => ({
    caseNumber: c.caseNumber,
    customer: c.customer?.name,
    phone: c.customer?.phone,
    status: CASE_STATUS_LABEL[c.status] || c.status,
    purchaseMethod: c.purchaseMethod ? PURCHASE_METHOD_LABEL[c.purchaseMethod] || c.purchaseMethod : '',
    appointmentRank: c.appointmentRank || '',
    referralSource: c.referralSource || '',
    booker: c.booker?.name || '',
    appraiser: c.appraiser?.name || '',
    worker: c.worker?.name || '',
    reservedAt: dt(c.reservedAt),
    appraisalAt: dt(c.appraisalAt),
    appraisalHours: c.appraisalHours ?? '',
    workAt: dt(c.workAt),
    workHours: c.workHours ?? '',
    contractAt: dt(c.contractAt),
    createdAt: dt(c.createdAt),
  }));
  send(res, 'cases.csv', rows, [
    { key: 'caseNumber', label: '案件番号' },
    { key: 'customer', label: '顧客名' },
    { key: 'phone', label: '電話番号' },
    { key: 'status', label: 'ステータス' },
    { key: 'purchaseMethod', label: '買取方法' },
    { key: 'appointmentRank', label: 'アポランク' },
    { key: 'referralSource', label: '反響経路' },
    { key: 'booker', label: '予約担当' },
    { key: 'appraiser', label: '査定担当' },
    { key: 'worker', label: '作業担当' },
    { key: 'reservedAt', label: '予約日' },
    { key: 'appraisalAt', label: '査定日' },
    { key: 'appraisalHours', label: '査定時間(h)' },
    { key: 'workAt', label: '作業日' },
    { key: 'workHours', label: '作業時間(h)' },
    { key: 'contractAt', label: '契約日' },
    { key: 'createdAt', label: '登録日時' },
  ]);
});

/** 顧客 */
router.get('/customers.csv', async (_req, res) => {
  const data = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
  const rows = data.map((c: any) => ({
    name: c.name,
    lastNameKana: c.lastNameKana || '',
    firstNameKana: c.firstNameKana || '',
    lastName: c.lastName || '',
    firstName: c.firstName || '',
    phone: c.phone,
    email: c.email || '',
    postalCode: c.postalCode || '',
    address: [c.prefecture, c.city, c.address, c.building].filter(Boolean).join(' '),
    customerType: CUSTOMER_TYPE_LABEL[c.customerType] || c.customerType,
    createdAt: dt(c.createdAt),
  }));
  send(res, 'customers.csv', rows, [
    { key: 'name', label: '氏名' },
    { key: 'lastNameKana', label: '苗字(カナ)' },
    { key: 'firstNameKana', label: '名(カナ)' },
    { key: 'lastName', label: '姓(漢字)' },
    { key: 'firstName', label: '名(漢字)' },
    { key: 'phone', label: '電話番号' },
    { key: 'email', label: 'メール' },
    { key: 'postalCode', label: '郵便番号' },
    { key: 'address', label: '住所' },
    { key: 'customerType', label: '顧客種別' },
    { key: 'createdAt', label: '登録日時' },
  ]);
});

/** 在庫（一覧と同じ絞り込みに対応。既定で売却済・廃棄を除外） */
router.get('/inventory.csv', async (req, res) => {
  const { inventoryNumber, name, grade, salesChannel, status, stockedFrom, stockedTo, appraiserId, caseNumber, includeClosed } =
    req.query as Record<string, string>;
  const statusWhere = status
    ? (status as any)
    : includeClosed === 'true'
      ? undefined
      : { notIn: ['SOLD', 'DISPOSED'] as any };
  const data = await prisma.inventoryItem.findMany({
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
    include: { sourceCase: true },
    orderBy: { createdAt: 'desc' },
  });
  const rows = data.map((i) => ({
    inventoryNumber: i.inventoryNumber,
    name: i.name,
    quantity: i.quantity,
    grade: i.grade,
    purchaseAmount: i.purchaseAmount,
    expectedAmount: i.expectedAmount,
    salesChannel: i.salesChannel || '',
    status: INVENTORY_STATUS_LABEL[i.status] || i.status,
    storageLocation: i.storageLocation || '',
    sourceCase: i.sourceCase?.caseNumber || '',
    stockedAt: dt(i.stockedAt),
  }));
  send(res, 'inventory.csv', rows, [
    { key: 'inventoryNumber', label: '在庫番号' },
    { key: 'name', label: '商品名' },
    { key: 'quantity', label: '数量' },
    { key: 'grade', label: 'グレード' },
    { key: 'purchaseAmount', label: '買取金額' },
    { key: 'expectedAmount', label: '見込金額' },
    { key: 'salesChannel', label: '販路' },
    { key: 'status', label: 'ステータス' },
    { key: 'storageLocation', label: '保管場所' },
    { key: 'sourceCase', label: '仕入元案件' },
    { key: 'stockedAt', label: '仕入日' },
  ]);
});

/** 販売 */
router.get('/sales.csv', async (_req, res) => {
  const data = await prisma.sale.findMany({
    include: { inventory: true },
    orderBy: { soldDate: 'desc' },
  });
  const rows = data.map((s) => ({
    inventoryNumber: s.inventory?.inventoryNumber || '',
    name: s.inventory?.name || '',
    soldDate: date(s.soldDate),
    paidDate: date(s.paidDate),
    salesAmount: s.salesAmount,
    fee: s.fee,
    shipping: s.shipping,
    otherCost: s.otherCost,
    profit: s.salesAmount - s.fee - s.shipping - s.otherCost - (s.inventory?.purchaseAmount || 0),
    salesChannel: s.salesChannel || '',
    buyer: s.buyer || '',
    status: SALE_STATUS_LABEL[s.status] || s.status,
  }));
  send(res, 'sales.csv', rows, [
    { key: 'inventoryNumber', label: '在庫番号' },
    { key: 'name', label: '商品名' },
    { key: 'soldDate', label: '販売日' },
    { key: 'paidDate', label: '入金日' },
    { key: 'salesAmount', label: '販売金額' },
    { key: 'fee', label: '手数料' },
    { key: 'shipping', label: '送料' },
    { key: 'otherCost', label: 'その他原価' },
    { key: 'profit', label: '粗利(概算)' },
    { key: 'salesChannel', label: '販路' },
    { key: 'buyer', label: '販売先' },
    { key: 'status', label: 'ステータス' },
  ]);
});

/** 入出金 */
router.get('/payments.csv', async (_req, res) => {
  const data = await prisma.payment.findMany({
    include: { case: true },
    orderBy: { createdAt: 'desc' },
  });
  const rows = data.map((p) => ({
    caseNumber: p.case?.caseNumber || '',
    direction: PAYMENT_DIRECTION_LABEL[p.direction] || p.direction,
    amount: p.amount,
    scheduledDate: date(p.scheduledDate),
    executedDate: date(p.executedDate),
    bankName: p.bankName || '',
    branchName: p.branchName || '',
    accountHolder: p.accountHolder || '',
    status: PAYMENT_STATUS_LABEL[p.status] || p.status,
    note: p.note || '',
  }));
  send(res, 'payments.csv', rows, [
    { key: 'caseNumber', label: '案件番号' },
    { key: 'direction', label: '区分' },
    { key: 'amount', label: '金額' },
    { key: 'scheduledDate', label: '予定日' },
    { key: 'executedDate', label: '実行日' },
    { key: 'bankName', label: '金融機関' },
    { key: 'branchName', label: '支店' },
    { key: 'accountHolder', label: '口座名義' },
    { key: 'status', label: '状態' },
    { key: 'note', label: '備考' },
  ]);
});

/** 領収書 */
router.get('/receipts.csv', async (_req, res) => {
  const data = await prisma.receipt.findMany({
    include: { case: true },
    orderBy: { issuedAt: 'desc' },
  });
  const rows = data.map((r) => ({
    receiptNumber: r.receiptNumber,
    caseNumber: r.case?.caseNumber || '',
    issuedAt: date(r.issuedAt),
    recipientName: r.recipientName,
    amount: r.amount,
    paymentMethod: SETTLEMENT_METHOD_LABEL[r.paymentMethod] || r.paymentMethod,
    status: RECEIPT_STATUS_LABEL[r.status] || r.status,
    registrationNumber: r.registrationNumber || '',
  }));
  send(res, 'receipts.csv', rows, [
    { key: 'receiptNumber', label: '領収書番号' },
    { key: 'caseNumber', label: '案件番号' },
    { key: 'issuedAt', label: '発行日' },
    { key: 'recipientName', label: '宛名' },
    { key: 'amount', label: '金額' },
    { key: 'paymentMethod', label: '支払方法' },
    { key: 'status', label: '状態' },
    { key: 'registrationNumber', label: '登録番号' },
  ]);
});

/** ユーザー */
router.get('/users.csv', async (_req, res) => {
  const data = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const rows = data.map((u) => ({
    name: u.name,
    email: u.email,
    role: ROLE_LABEL[u.role] || u.role,
    active: u.active ? '有効' : '無効',
    createdAt: dt(u.createdAt),
  }));
  send(res, 'users.csv', rows, [
    { key: 'name', label: '氏名' },
    { key: 'email', label: 'メール' },
    { key: 'role', label: '権限' },
    { key: 'active', label: '状態' },
    { key: 'createdAt', label: '登録日時' },
  ]);
});

/** 操作ログ */
router.get('/audit-logs.csv', async (_req, res) => {
  const data = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });
  const rows = data.map((a) => ({
    createdAt: dt(a.createdAt),
    user: a.user?.name || '',
    action: a.action,
    description: a.description || '',
    caseNumber: a.caseNumber || '',
    entity: a.entity || '',
    ipAddress: a.ipAddress || '',
  }));
  send(res, 'audit-logs.csv', rows, [
    { key: 'createdAt', label: '日時' },
    { key: 'user', label: '操作者' },
    { key: 'action', label: '操作' },
    { key: 'description', label: '内容' },
    { key: 'caseNumber', label: '案件番号' },
    { key: 'entity', label: '対象' },
    { key: 'ipAddress', label: 'IP' },
  ]);
});

export default router;
