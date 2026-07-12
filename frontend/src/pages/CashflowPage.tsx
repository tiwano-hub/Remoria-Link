import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { yen } from '../lib/format';

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthRange = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
};

export default function CashflowPage() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setData(null);
    const { from, to } = monthRange(month);
    api.get<any>(`/api/analytics/cashflow?from=${from}&to=${to}`).then(setData).catch((e) => setError(e.message));
  }, [month]);

  return (
    <div>
      <h2>入出金レポート（差引前・総額）</h2>

      <div className="card">
        <label>対象月</label>
        <input type="month" style={{ maxWidth: 200 }} value={month} onChange={(e) => setMonth(e.target.value)} />
        <p className="muted" style={{ marginTop: 8 }}>
          その月に「当社→顧客へ支払った総額」と「顧客→当社で受け取った総額」を、差し引きせずに表示します。<br />
          （例：Aさんから1万円で仕入れ、作業料2万円を受領 → 支払1万円・受取2万円として計上）
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <div className="grid2">
            <div className="card">
              <h3>受取（顧客 → 当社）</h3>
              <div className="kpi value" style={{ fontSize: 28 }}>{yen(data.totals.received)}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                現金 {yen(data.summary.receivedCash)}　／　振込 {yen(data.summary.receivedTransfer)}
              </div>
            </div>
            <div className="card">
              <h3>支払（当社 → 顧客）</h3>
              <div className="kpi value" style={{ fontSize: 28 }}>{yen(data.totals.paid)}</div>
              <div className="muted" style={{ marginTop: 6 }}>
                現金 {yen(data.summary.paidCash)}　／　振込 {yen(data.summary.paidTransfer)}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>明細（{data.transactions.length}件）</h3>
            <table>
              <thead>
                <tr><th>日付</th><th>区分</th><th>案件</th><th>顧客</th><th className="num">金額</th></tr>
              </thead>
              <tbody>
                {data.transactions.map((t: any, i: number) => (
                  <tr key={i}>
                    <td>{t.date}</td>
                    <td>
                      <span className={`badge ${t.kind.includes('受取') ? 'green' : 'amber'}`}>{t.kind}</span>
                    </td>
                    <td>{t.caseNumber}</td>
                    <td>{t.customer}</td>
                    <td className="num">{yen(t.amount)}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 && <tr><td colSpan={5} className="muted">この月の入出金はありません</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
