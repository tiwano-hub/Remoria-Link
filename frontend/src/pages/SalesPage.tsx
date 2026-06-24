import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Field, Kpi } from '../components/ui';
import { yen, date, pct } from '../lib/format';
import { GRADES, User } from '../types';

const SALES_STATUS_LABEL: Record<string, string> = {
  COMPLETED: '完了', PENDING: '処理中', CANCELLED: '取消',
};

export default function SalesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<{ name: string }[]>([]);
  const [f, setF] = useState({
    soldFrom: '', soldTo: '', paidFrom: '', paidTo: '',
    inventoryNumber: '', name: '', grade: '', salesChannel: '',
    appraiserId: '', caseNumber: '', minAmount: '', maxAmount: '', status: '',
  });

  useEffect(() => {
    api.get<User[]>('/api/users').then(setUsers).catch(() => {});
    api.get<any>('/api/masters').then((m) => setChannels(m.channels)).catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    api.get<any[]>(`/api/sales?${qs.toString()}`).then(setRows).catch(() => {});
  }, [f]);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const count = rows.length;
  const salesTotal = rows.reduce((acc, r) => acc + (Number(r.salesAmount) || 0), 0);
  const grossTotal = rows.reduce((acc, r) => acc + (Number(r.realGrossProfit) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>販売実績</h2>
        <a href={`${api.baseUrl}/api/sales/csv`} target="_blank" rel="noreferrer"><button className="btn-sub">CSV出力</button></a>
      </div>

      <div className="grid3">
        <Kpi label="件数" value={count} />
        <Kpi label="実売上合計" value={yen(salesTotal)} />
        <Kpi label="実粗利合計" value={yen(grossTotal)} />
      </div>

      <div className="card">
        <div className="toolbar">
          <Field label="販売日（自）"><input type="date" value={f.soldFrom} onChange={set('soldFrom')} /></Field>
          <Field label="販売日（至）"><input type="date" value={f.soldTo} onChange={set('soldTo')} /></Field>
          <Field label="入金日（自）"><input type="date" value={f.paidFrom} onChange={set('paidFrom')} /></Field>
          <Field label="入金日（至）"><input type="date" value={f.paidTo} onChange={set('paidTo')} /></Field>
          <Field label="在庫番号"><input value={f.inventoryNumber} onChange={set('inventoryNumber')} /></Field>
          <Field label="商品名"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="グレード">
            <select value={f.grade} onChange={set('grade')}>
              <option value="">全て</option>
              {GRADES.map((g) => <option key={g} value={g}>{g === 'NONE' ? 'なし' : g}</option>)}
            </select>
          </Field>
          <Field label="販路">
            <select value={f.salesChannel} onChange={set('salesChannel')}>
              <option value="">全て</option>
              {channels.map((ch) => <option key={ch.name} value={ch.name}>{ch.name}</option>)}
            </select>
          </Field>
          <Field label="査定担当者">
            <select value={f.appraiserId} onChange={set('appraiserId')}>
              <option value="">全て</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="案件番号"><input value={f.caseNumber} onChange={set('caseNumber')} /></Field>
          <Field label="販売金額（下限）"><input type="number" value={f.minAmount} onChange={set('minAmount')} /></Field>
          <Field label="販売金額（上限）"><input type="number" value={f.maxAmount} onChange={set('maxAmount')} /></Field>
          <Field label="販売ステータス">
            <select value={f.status} onChange={set('status')}>
              <option value="">全て</option>
              {Object.entries(SALES_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <table>
          <thead>
            <tr>
              <th>販売日</th><th>入金日</th><th>在庫番号</th><th>商品名</th><th>グレード</th>
              <th className="num">買取金額</th><th className="num">販売金額</th><th className="num">実粗利</th>
              <th className="num">原価率</th><th>販路</th><th>販売先</th><th>元案件番号</th><th>顧客名</th><th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{date(r.soldDate)}</td>
                <td>{date(r.paidDate)}</td>
                <td>{r.inventoryId ? <Link to={`/inventory/${r.inventoryId}`}>{r.inventoryNumber}</Link> : r.inventoryNumber}</td>
                <td>{r.name}</td>
                <td>{r.grade === 'NONE' ? 'なし' : r.grade}</td>
                <td className="num">{yen(r.purchaseAmount)}</td>
                <td className="num">{yen(r.salesAmount)}</td>
                <td className="num">{yen(r.realGrossProfit)}</td>
                <td className="num">{pct(r.costRate)}</td>
                <td>{r.salesChannel || '-'}</td>
                <td>{r.buyer || '-'}</td>
                <td>{r.sourceCaseId ? <Link to={`/cases/${r.sourceCaseId}`}>{r.sourceCaseNumber}</Link> : '-'}</td>
                <td>{r.customerName || '-'}</td>
                <td>{SALES_STATUS_LABEL[r.status] || r.status || '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={14} className="muted">販売実績がありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
