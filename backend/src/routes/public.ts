import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { audit } from '../services/audit';
import { generateContractPdf } from '../services/pdf';
import { ContractSnapshot } from '../services/contractSnapshot';

/**
 * 顧客向けの認証不要ルート（トークン経由）。
 * 社内情報は一切返さない（snapshot は顧客安全な内容のみ）。
 */
const router = Router();

/** GET /api/public/contracts/:token  顧客が契約内容を確認 */
router.get('/contracts/:token', async (req, res) => {
  const contract = await prisma.contract.findUnique({
    where: { token: req.params.token },
    include: { signature: true },
  });
  if (!contract) return res.status(404).json({ error: '契約書が見つかりません' });
  res.json({
    id: contract.id,
    status: contract.status,
    settlementMethod: contract.settlementMethod,
    snapshot: contract.snapshot, // 顧客安全なスナップショットのみ
    signed: !!contract.signature,
  });
});

/** POST /api/public/contracts/:token/identity  顧客が身分証を登録 */
router.post('/contracts/:token/identity', async (req, res) => {
  const schema = z.object({
    method: z.enum([
      'FACE_TO_FACE',
      'NONFACE_REGISTERED_MAIL',
      'NONFACE_ID_IMAGE_PLUS',
      'NONFACE_IC_CHIP',
      'NONFACE_E_SIGNATURE',
    ]),
    documentType: z.enum([
      'DRIVERS_LICENSE',
      'MY_NUMBER_CARD',
      'PASSPORT',
      'RESIDENCE_CARD',
      'HEALTH_INSURANCE',
      'OTHER',
    ]),
    imageUrl: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const contract = await prisma.contract.findUnique({
    where: { token: req.params.token },
    include: { case: true },
  });
  if (!contract) return res.status(404).json({ error: '契約書が見つかりません' });

  // 非対面取引で画像のみは不可
  if (contract.case.purchaseMethod === 'DELIVERY' && parsed.data.method === 'FACE_TO_FACE') {
    return res.status(400).json({ error: '宅配（非対面）取引では対面確認は選択できません' });
  }

  const rec = await prisma.identityVerification.create({
    data: {
      caseId: contract.caseId,
      method: parsed.data.method,
      documentType: parsed.data.documentType,
      imageUrl: parsed.data.imageUrl,
      verifiedAt: new Date(),
      verificationLog: { source: 'customer', recordedAt: new Date().toISOString() },
    },
  });
  await audit(req, {
    action: 'IDENTITY_REGISTER',
    caseNumber: contract.case.caseNumber,
    entity: 'IdentityVerification',
    entityId: rec.id,
    description: '顧客による身分証登録',
  });
  res.status(201).json({ ok: true });
});

/** POST /api/public/contracts/:token/name  顧客が漢字氏名を入力 */
router.post('/contracts/:token/name', async (req, res) => {
  const schema = z.object({ lastName: z.string().min(1), firstName: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const contract = await prisma.contract.findUnique({
    where: { token: req.params.token },
    include: { case: true, signature: true },
  });
  if (!contract) return res.status(404).json({ error: '契約書が見つかりません' });
  if (contract.signature) return res.status(409).json({ error: '既に署名済みです' });

  const fullName = [parsed.data.lastName, parsed.data.firstName].filter(Boolean).join(' ');

  // 顧客マスタに漢字氏名を反映
  await prisma.customer.update({
    where: { id: contract.case.customerId },
    data: { lastName: parsed.data.lastName, firstName: parsed.data.firstName ?? null, name: fullName } as any,
  });

  // 契約スナップショットの表示名も漢字に更新（確認画面・PDFへ反映）
  const snap: any = contract.snapshot;
  if (snap?.customer) snap.customer.name = fullName;
  await prisma.contract.update({ where: { id: contract.id }, data: { snapshot: snap } });

  await audit(req, {
    action: 'CASE_UPDATE',
    caseNumber: contract.case.caseNumber,
    entity: 'Customer',
    entityId: contract.case.customerId,
    description: '顧客による漢字氏名の入力',
  });
  res.json({ ok: true });
});

/** POST /api/public/contracts/:token/sign  手書きサイン → 契約成立・PDF保存 */
router.post('/contracts/:token/sign', async (req, res) => {
  const schema = z.object({ imageData: z.string(), signedName: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const contract = await prisma.contract.findUnique({
    where: { token: req.params.token },
    include: { case: true, signature: true },
  });
  if (!contract) return res.status(404).json({ error: '契約書が見つかりません' });
  if (contract.signature) return res.status(409).json({ error: '既に署名済みです' });

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;

  await prisma.signature.create({
    data: {
      contractId: contract.id,
      imageData: parsed.data.imageData,
      signedName: parsed.data.signedName,
      ipAddress: ip,
    },
  });

  // PDF を生成しハッシュを保存（電子帳簿保存法：真実性確保）
  const snap = contract.snapshot as unknown as ContractSnapshot;
  const issuer = { name: 'Remoria Link 加盟店', license: '' };
  const pdf = await generateContractPdf({
    caseNumber: snap.caseNumber,
    contractDate: snap.contractDate || new Date().toISOString().slice(0, 10),
    purchaseMethod: snap.purchaseMethod || '',
    customer: { name: snap.customer.name, address: snap.customer.address, phone: snap.customer.phone },
    items: snap.items.map((i) => ({ name: i.name, quantity: i.quantity, grade: i.grade, amount: i.amount })),
    caseOptions: snap.caseOptions,
    purchaseTotal: snap.purchaseTotal,
    optionTotal: snap.optionTotal,
    payable: snap.payable,
    settlementMethod: contract.settlementMethod || '',
    customerMessage: snap.customerMessage || undefined,
    issuer,
    signatureImage: parsed.data.imageData,
  });
  const pdfHash = crypto.createHash('sha256').update(pdf).digest('hex');

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: 'COMPLETED',
      signedAt: new Date(),
      completedAt: new Date(),
      contentHash: pdfHash,
    },
  });

  await audit(req, {
    action: 'SIGNATURE_COMPLETE',
    caseNumber: contract.case.caseNumber,
    entity: 'Contract',
    entityId: contract.id,
    description: '顧客署名完了・契約成立',
  });

  res.json({ ok: true });
});

/** GET /api/public/contracts/:token/pdf  契約書PDF（顧客控え）ダウンロード */
router.get('/contracts/:token/pdf', async (req, res) => {
  const contract = await prisma.contract.findUnique({
    where: { token: req.params.token },
    include: { signature: true },
  });
  if (!contract) return res.status(404).json({ error: '契約書が見つかりません' });
  const snap = contract.snapshot as unknown as ContractSnapshot;
  const pdf = await generateContractPdf({
    caseNumber: snap.caseNumber,
    contractDate: snap.contractDate || '',
    purchaseMethod: snap.purchaseMethod || '',
    customer: { name: snap.customer.name, address: snap.customer.address, phone: snap.customer.phone },
    items: snap.items.map((i) => ({ name: i.name, quantity: i.quantity, grade: i.grade, amount: i.amount })),
    caseOptions: snap.caseOptions,
    purchaseTotal: snap.purchaseTotal,
    optionTotal: snap.optionTotal,
    payable: snap.payable,
    settlementMethod: contract.settlementMethod || '',
    customerMessage: snap.customerMessage || undefined,
    issuer: { name: 'Remoria Link 加盟店' },
    signatureImage: contract.signature?.imageData,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="contract-${snap.caseNumber}.pdf"`);
  res.send(pdf);
});

/** GET /api/public/receipts/:token  顧客が領収書を確認 */
router.get('/receipts/:token', async (req, res) => {
  const receipt = await prisma.receipt.findUnique({ where: { token: req.params.token } });
  if (!receipt) return res.status(404).json({ error: '領収書が見つかりません' });
  res.json({
    receiptNumber: receipt.receiptNumber,
    issuedAt: receipt.issuedAt,
    recipientName: receipt.recipientName,
    amount: receipt.amount,
    description: receipt.description,
    paymentMethod: receipt.paymentMethod,
    registrationNumber: receipt.registrationNumber,
    status: receipt.status,
  });
});

export default router;
