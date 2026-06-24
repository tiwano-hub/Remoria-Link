import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Field } from '../components/ui';
import { yen, date } from '../lib/format';

const METHOD_LABEL: Record<string, string> = {
  CASH: '現金', BANK_TRANSFER: '振込', OFFSET: '差引精算',
};

const STATUS_LABEL: Record<string, string> = {
  ISSUED: '発行済', CANCELLED: '取消', REISSUED: '再発行（旧）',
};

const STATUS_CLASS: Record<string, string> = {
  ISSUED: 'green', CANCELLED: 'red', REISSUED: 'gray',
};

export default function ReceiptsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ from: '', to: '', recipient: '', minAmount: '', maxAmount: '' });

  const reload = () => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    api.get<any[]>(`/api/receipts?${qs.toString()}`).then(setRows).catch(() => {});
  };

  useEffect(reload, [f]);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const cancel = (id: string) => {
    const reason = window.prompt('取消理由を入力してください');
    if (!reason) return;
    api.post<any>(`/api/receipts/${id}/cancel`, { reason }).then(reload).catch(() => {});
  };

  const reissue = (id: string) => {
    const reason = window.prompt('再発行理由を入力してください');
    if (!reason) return;
    api.post<any>(`/api/receipts/${id}/reissue`, { reason }).then(reload).catch(() => {});
  };

  return (
    <div>
      <h2>電子領収書</h2>
      <p className="muted">電子帳簿保存法対応：発行日・金額・取引先名で検索できます</p>

      <div className="card">
        <div className="toolbar">
          <Field label="発行日（自）"><input type="date" value={f.from} onChange={set('from')} /></Field>
          <Field label="発行日（至）"><input type="date" value={f.to} onChange={set('to')} /></Field>
          <Field label="取引先名"><input value={f.recipient} onChange={set('recipient')} /></Field>
          <Field label="金額（下限）"><input type="number" value={f.minAmount} onChange={set('minAmount')} /></Field>
          <Field label="金額（上限）"><input type="number" value={f.maxAmount} onChange={set('maxAmount')} /></Field>
        </div>

        <table>
          <thead>
            <tr>
              <th>領収書番号</th><th>発行日</th><th>宛名</th>
              <th className="num">金額</th><th>支払方法</th><th>案件番号</th>
              <th>状態</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.receiptNumber}</td>
                <td>{date(r.issuedAt)}</td>
                <td>{r.recipientName}</td>
                <td className="num">{yen(r.amount)}</td>
                <td>{METHOD_LABEL[r.paymentMethod] || r.paymentMethod}</td>
                <td>{r.case?.caseNumber || '-'}</td>
                <td><span className={`badge ${STATUS_CLASS[r.status] || 'gray'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td>
                  <div className="row">
                    <a href={`${api.baseUrl}/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
                    <a href={`/receipt/${r.token}`} target="_blank" rel="noreferrer">顧客用</a>
                    {r.status === 'ISSUED' && (
                      <>
                        <button className="btn-sm btn-danger" onClick={() => cancel(r.id)}>取消</button>
                        <button className="btn-sm btn-sub" onClick={() => reissue(r.id)}>再発行</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">領収書がありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
