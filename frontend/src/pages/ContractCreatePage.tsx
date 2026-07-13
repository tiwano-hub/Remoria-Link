import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Field } from '../components/ui';
import { yen } from '../lib/format';

export default function ContractCreatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [settlementMethod, setSettlementMethod] = useState('CASH');
  const [created, setCreated] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<any>(`/api/cases/${id}`).then(setC).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!c) return <div className="muted">読み込み中...</div>;

  const visibleItems = c.purchaseItems.filter((i: any) => !i.isLost);
  const t = c.totals;

  const create = async () => {
    try {
      const r = await api.post<any>('/api/contracts', { caseId: id, settlementMethod });
      setCreated(r);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const send = async (channel: string) => {
    try {
      await api.post<any>(`/api/contracts/${created.id}/send`, { channel });
      alert(channel === 'sms' ? 'SMSで送信しました' : 'メールで送信しました');
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div>
      <h2>契約書作成 — {c.caseNumber}</h2>
      <p className="muted">顧客に表示されるのは下記の内容のみです（見込金額・販路・原価・粗利・社内メモ・社内写真・失点明細は非表示）。</p>

      <div className="card">
        <h3>古物売買契約書（プレビュー）</h3>
        <div><b>お客様：</b>{c.customer.name} 様</div>
        <div>{c.customer.prefecture}{c.customer.city}{c.customer.address} {c.customer.building}</div>
        <div><b>買取方法：</b>{({ VISIT: '出張', DELIVERY: '宅配', STORE: '店頭', CONSIGNMENT: '委託' } as any)[c.purchaseMethod] || '-'}</div>
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>商品名</th><th>数量</th><th>グレード</th><th className="num">買取金額(税込)</th></tr></thead>
          <tbody>
            {visibleItems.map((i: any) => (
              <tr key={i.id}><td>{i.name}</td><td>{i.quantity}</td><td>{i.grade}</td><td className="num">{yen(i.purchaseAmount)}</td></tr>
            ))}
          </tbody>
        </table>
        {c.caseOptions.filter((o: any) => o.showOnContract).length > 0 && (
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>オプション</th><th>数量</th><th className="num">金額(税込)</th></tr></thead>
            <tbody>{c.caseOptions.filter((o: any) => o.showOnContract).map((o: any) => (
              <tr key={o.id}><td>{o.name}</td><td>{o.quantity}</td><td className="num">{yen(o.amount)}</td></tr>))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 10, fontSize: 16 }}>
          <b>{t.customerPayable >= 0 ? 'お支払額' : 'ご請求額'}：{yen(Math.abs(t.customerPayable))}</b>
        </div>
        {c.customerMessage && <p>メッセージ：{c.customerMessage}</p>}
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <Field label="支払方法">
          <select value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value)}>
            <option value="CASH">現金</option><option value="BANK_TRANSFER">振込</option><option value="OFFSET">差引精算</option>
          </select>
        </Field>
        {!created ? (
          <button onClick={create}>契約書を作成（顧客リンク発行）</button>
        ) : (
          <div>
            <div className="badge green">作成しました</div>
            <p>顧客リンク：<a href={`/sign/${created.token}`} target="_blank" rel="noreferrer">{created.url}</a></p>
            <div className="row">
              <button className="btn-sub" onClick={() => send('sms')}>SMSで送信</button>
              <button className="btn-sub" onClick={() => send('email')}>メールで送信</button>
              <button onClick={() => navigate(`/cases/${id}`)}>案件へ戻る</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
