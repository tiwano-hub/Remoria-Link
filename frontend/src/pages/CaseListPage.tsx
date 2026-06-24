import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { StatusBadge } from '../components/ui';
import { date } from '../lib/format';
import { CASE_STATUS_LABEL } from '../types';

export default function CaseListPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') || '';
  const status = params.get('status') || '';

  const load = () => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    api.get<any[]>(`/api/cases?${qs.toString()}`).then(setCases).catch(() => {});
  };
  useEffect(load, [q, status]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>案件一覧</h2>
        <Link to="/intake"><button>新規案件（電話番号入力）</button></Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <div>
            <label>検索（案件番号・顧客名・電話）</label>
            <input value={q} onChange={(e) => setParams({ q: e.target.value, status })} placeholder="キーワード" />
          </div>
          <div>
            <label>ステータス</label>
            <select value={status} onChange={(e) => setParams({ q, status: e.target.value })}>
              <option value="">すべて</option>
              {Object.entries(CASE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>案件番号</th><th>顧客名</th><th>電話番号</th><th>ステータス</th>
              <th>査定日</th><th>作業日</th><th>査定担当</th><th>予約担当</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                <td>{c.caseNumber}</td>
                <td>{c.customer?.name}</td>
                <td>{c.customer?.phone}</td>
                <td><StatusBadge status={c.status} /></td>
                <td>{date(c.appraisalAt)}</td>
                <td>{date(c.workAt)}</td>
                <td>{c.appraiser?.name || '-'}</td>
                <td>{c.booker?.name || '-'}</td>
              </tr>
            ))}
            {cases.length === 0 && <tr><td colSpan={8} className="muted">案件がありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
