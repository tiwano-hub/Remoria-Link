import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * 契約書・領収書 PDF 生成。
 * 日本語表示には TTF フォントが必要。`assets/fonts/NotoSansJP-Regular.ttf` が存在すれば
 * 使用し、無ければ標準フォント（英数字のみ）にフォールバックする。
 */

const FONT_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansJP-Regular.ttf');
const hasJpFont = fs.existsSync(FONT_PATH);

function newDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  if (hasJpFont) doc.font(FONT_PATH);
  return doc;
}

function toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

const yen = (n: number) => `${n.toLocaleString('ja-JP')} 円`;

export interface ContractPdfData {
  caseNumber: string;
  contractDate: string;
  purchaseMethod: string;
  customer: {
    name: string;
    address: string;
    phone: string;
  };
  items: { name: string; quantity: number; grade: string; amount: number }[];
  caseOptions: { name: string; quantity: number; amount: number }[];
  purchaseTotal: number;
  optionTotal: number;
  payable: number; // 差引後支払額（マイナスなら請求額）
  settlementMethod: string;
  customerMessage?: string;
  issuer: { name: string; address?: string; license?: string };
  signatureImage?: string; // dataURL
}

export async function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const doc = newDoc();

  doc.fontSize(18).text('古物売買契約書', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`案件番号: ${data.caseNumber}`);
  doc.text(`契約日: ${data.contractDate}`);
  doc.text(`買取方法: ${data.purchaseMethod}`);
  doc.moveDown(0.5);

  doc.fontSize(12).text('お客様情報');
  doc.fontSize(10);
  doc.text(`氏名: ${data.customer.name}`);
  doc.text(`住所: ${data.customer.address}`);
  doc.text(`電話番号: ${data.customer.phone}`);
  doc.moveDown(0.5);

  doc.fontSize(12).text('買取商品明細（税込）');
  doc.fontSize(10);
  data.items.forEach((it) => {
    doc.text(`・${it.name}　数量:${it.quantity}　グレード:${it.grade}　${yen(it.amount)}`);
  });
  doc.moveDown(0.3);
  doc.text(`買取金額合計: ${yen(data.purchaseTotal)}`);

  if (data.caseOptions.length > 0) {
    doc.moveDown(0.5);
    doc.fontSize(12).text('オプション（税込）');
    doc.fontSize(10);
    data.caseOptions.forEach((o) => {
      doc.text(`・${o.name}　数量:${o.quantity}　${yen(o.amount)}`);
    });
    doc.text(`オプション合計: ${yen(data.optionTotal)}`);
  }

  doc.moveDown(0.5);
  doc.fontSize(12);
  if (data.payable >= 0) {
    doc.text(`お支払額: ${yen(data.payable)}`);
  } else {
    doc.text(`ご請求額: ${yen(-data.payable)}`);
  }
  doc.fontSize(10).text(`支払方法: ${data.settlementMethod}`);

  if (data.customerMessage) {
    doc.moveDown(0.5);
    doc.fontSize(12).text('お客様へのメッセージ');
    doc.fontSize(10).text(data.customerMessage);
  }

  doc.moveDown(1);
  doc.fontSize(10).text('発行者');
  doc.text(data.issuer.name);
  if (data.issuer.address) doc.text(data.issuer.address);
  if (data.issuer.license) doc.text(`古物商許可番号: ${data.issuer.license}`);

  doc.moveDown(1);
  doc.text('お客様署名:');
  if (data.signatureImage && data.signatureImage.startsWith('data:image')) {
    try {
      const base64 = data.signatureImage.split(',')[1];
      const buf = Buffer.from(base64, 'base64');
      doc.image(buf, { width: 200 });
    } catch {
      /* ignore */
    }
  }

  return toBuffer(doc);
}

export interface ReceiptPdfData {
  receiptNumber: string;
  issuedAt: string;
  recipientName: string;
  amount: number;
  taxRate: number;
  taxExcluded: number;
  taxAmount: number;
  description: string;
  paymentMethod: string;
  issuer: { name: string; address?: string; registrationNumber?: string };
  caseNumber: string;
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const doc = newDoc();

  doc.fontSize(20).text('領 収 書', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`領収書番号: ${data.receiptNumber}`, { align: 'right' });
  doc.text(`発行日: ${data.issuedAt}`, { align: 'right' });
  doc.moveDown();

  doc.fontSize(14).text(`${data.recipientName} 様`);
  doc.moveDown(0.5);
  doc.fontSize(22).text(yen(data.amount), { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`但し: ${data.description}`);
  doc.text(`（税抜 ${yen(data.taxExcluded)}　消費税 ${yen(data.taxAmount)}　税率 ${Math.round(data.taxRate * 100)}%）`);
  doc.text(`支払方法: ${data.paymentMethod}`);
  doc.text(`取引案件番号: ${data.caseNumber}`);
  doc.moveDown();

  doc.text('発行者');
  doc.text(data.issuer.name);
  if (data.issuer.address) doc.text(data.issuer.address);
  if (data.issuer.registrationNumber) doc.text(`登録番号: ${data.issuer.registrationNumber}`);

  return toBuffer(doc);
}
