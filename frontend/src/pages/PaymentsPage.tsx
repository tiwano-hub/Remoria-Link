import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Field, Kpi } from '../components/ui';
import { yen, date } from '../lib/format';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: '予定', COMPLETED: '完了', CANCELLED: '取消',
};

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: 'amber', COMPLETED: 'green', CANCELLED: 'red',
};

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ direction: '', status: '' });

  const reload = () => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    api.get<any[]>(`/api/payments?${qs.toString()}`).then(setRows).catch(() => {});
  };

  useEffect(reload, [f]);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const depositScheduled = rows
    .filter((r) => r.direction === 'DEPOSIT' && r.status === 'SCHEDULED')
    .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const withdrawalScheduled = rows
    .filter((r) => r.direction === 'WITHDRAWAL' && r.status === 'SCHEDULED')
    .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

  const complete = (id: string) => {
    api.put<any>(`/api/payments/${id}`, { status: 'COMPLETED', executedDate: new Date().toISOString() })
      .then(reload)
      .catch(() => {});
  };

  const cancel = (id: string) => {
    api.put<any>(`/api/payments/${id}`, { status: 'CANCELLED' })
      .then(reload)
      .catch(() => {});
  };

  return (
    <div>
      <h2>入出金管理</h2>

      <div className="grid2">
        <Kpi label="入金予定合計" value={yen(depositScheduled)} />
        <Kpi label="出金予定合計" value={yen(withdrawalScheduled)} />
      </div>

      <div className="card">
        <div className="toolbar">
          <Field label="区分">
            <select value={f.direction} onChange={set('direction')}>
              <option value="">全て</option>
              <option value="DEPOSIT">入金</option>
              <option value="WITHDRAWAL">出金</option>
            </select>
          </Field>
          <Field label="ステータス">
            <select value={f.status} onChange={set('status')}>
              <option value="">全て</option>
              <option value="SCHEDULED">予定</option>
              <option value="COMPLETED">完了</option>
              <option value="CANCELLED">取消</option>
            </select>
          </Field>
        </div>

        <table>
          <thead>
            <tr>
              <th>案件番号</th><th>顧客名</th><th>区分</th>
              <th className="num">金額</th><th>予定日</th><th>実行日</th>
              <th>振込先／元</th><th>ステータス</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.case?.caseNumber || '-'}</td>
                <td>{r.case?.customer?.name || '-'}</td>
                <td>
                  <span className={`badge ${r.direction === 'DEPOSIT' ? 'blue' : 'amber'}`}>
                    {r.direction === 'DEPOSIT' ? '入金' : '出金'}
                  </span>
                </td>
                <td className="num">{yen(r.amount)}</td>
                <td>{date(r.scheduledDate)}</td>
                <td>{date(r.executedDate)}</td>
                <td>
                  {r.counterparty || r.accountHolder || '-'}
                  {(r.bankName || r.branchName) && (
                    <span className="muted"> {r.bankName || ''} {r.branchName || ''}</span>
                  )}
                </td>
                <td><span className={`badge ${STATUS_CLASS[r.status] || 'gray'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td>
                  {r.status === 'SCHEDULED' && (
                    <div className="row">
                      <button className="btn-sm" onClick={() => complete(r.id)}>完了にする</button>
                      <button className="btn-sm btn-danger" onClick={() => cancel(r.id)}>取消</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="muted">入出金がありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
