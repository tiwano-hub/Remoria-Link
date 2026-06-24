import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { yen, date } from '../lib/format';
import { CASE_STATUS_LABEL } from '../types';

interface LookupResult {
  found: boolean;
  customer?: any;
  history?: {
    id: string;
    caseNumber: string;
    date: string;
    status: keyof typeof CASE_STATUS_LABEL;
    items: string[];
    purchaseTotal: number;
    workFee: number;
    closed: boolean;
    appraiser?: string;
  }[];
}

export default function IntakePage() {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const lookup = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await api.get<LookupResult>(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const proceed = () => {
    navigate('/cases/new', {
      state: { phone, customer: result?.found ? result.customer : { phone, customerType: 'NEW' } },
    });
  };

  return (
    <div>
      <h2>電話番号入力</h2>
      <div className="card" style={{ maxWidth: 560 }}>
        <p className="muted">案件登録はお客様の電話番号入力から始まります。</p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="col">
            <label>電話番号</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09012345678"
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
            />
          </div>
          <button onClick={lookup} disabled={loading || !phone}>
            {loading ? '検索中...' : '検索'}
          </button>
        </div>
        {error && <div className="error">{error}</div>}

        {result && (
          <div style={{ marginTop: 16 }}>
            {result.found ? (
              <div className="badge green">既存顧客：{result.customer.name} 様（リピーター）</div>
            ) : (
              <div className="badge gray">新規のお客様です</div>
            )}
            <button style={{ display: 'block', marginTop: 14 }} onClick={proceed}>
              案件登録へ進む
            </button>
          </div>
        )}
      </div>

      {result?.found && result.history && result.history.length > 0 && (
        <div className="card">
          <h2>過去の案件履歴</h2>
          <table>
            <thead>
              <tr>
                <th>案件日</th>
                <th>案件番号</th>
                <th>ステータス</th>
                <th>買取商品</th>
                <th className="num">買取金額</th>
                <th className="num">作業費</th>
                <th>成約</th>
                <th>担当者</th>
              </tr>
            </thead>
            <tbody>
              {result.history.map((h) => (
                <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${h.id}`)}>
                  <td>{date(h.date)}</td>
                  <td>{h.caseNumber}</td>
                  <td>{CASE_STATUS_LABEL[h.status]}</td>
                  <td>{h.items.join('、') || '-'}</td>
                  <td className="num">{yen(h.purchaseTotal)}</td>
                  <td className="num">{yen(h.workFee)}</td>
                  <td>{h.closed ? '成約' : '不成約'}</td>
                  <td>{h.appraiser || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
