import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { yen, date } from '../lib/format';

export default function ReceiptPublicPage() {
  const { token } = useParams();
  const [r, setR] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<any>(`/api/public/receipts/${token}`).then(setR).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <div className="center-screen"><div className="card login-box"><div className="error">{error}</div></div></div>;
  if (!r) return <div className="center-screen">読み込み中...</div>;

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 420 }}>
        <h2 style={{ textAlign: 'center' }}>領収書</h2>
        {r.status !== 'ISSUED' && <p className="badge red">この領収書は{r.status === 'CANCELLED' ? '取消' : '再発行'}されています</p>}
        <p className="muted">No. {r.receiptNumber}　{date(r.issuedAt)}</p>
        <h3>{r.recipientName} 様</h3>
        <div style={{ fontSize: 28, textAlign: 'center', margin: '10px 0' }}>{yen(r.amount)}</div>
        <div>但し：{r.description}</div>
        <div>支払方法：{({ CASH: '現金', BANK_TRANSFER: '振込', OFFSET: '差引精算' } as any)[r.paymentMethod]}</div>
        {r.registrationNumber && <div className="muted">登録番号：{r.registrationNumber}</div>}
      </div>
    </div>
  );
}
