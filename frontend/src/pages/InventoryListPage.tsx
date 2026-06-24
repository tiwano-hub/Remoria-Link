import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Field, InventoryBadge } from '../components/ui';
import { yen, date } from '../lib/format';
import { GRADES, INVENTORY_STATUS_LABEL, User } from '../types';

export default function InventoryListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<{ name: string }[]>([]);
  const [f, setF] = useState({
    inventoryNumber: '', name: '', grade: '', salesChannel: '', status: '',
    stockedFrom: '', stockedTo: '', appraiserId: '', caseNumber: '',
  });

  useEffect(() => {
    api.get<User[]>('/api/users').then(setUsers).catch(() => {});
    api.get<any>('/api/masters').then((m) => setChannels(m.channels)).catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    api.get<any[]>(`/api/inventory?${qs.toString()}`).then(setItems).catch(() => {});
  }, [f]);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>在庫一覧</h2>
        <Link to="/inventory/new"><button>在庫登録</button></Link>
      </div>

      <div className="card">
        <div className="toolbar">
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
          <Field label="在庫ステータス">
            <select value={f.status} onChange={set('status')}>
              <option value="">全て</option>
              {Object.entries(INVENTORY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="仕入日（自）"><input type="date" value={f.stockedFrom} onChange={set('stockedFrom')} /></Field>
          <Field label="仕入日（至）"><input type="date" value={f.stockedTo} onChange={set('stockedTo')} /></Field>
          <Field label="査定担当者">
            <select value={f.appraiserId} onChange={set('appraiserId')}>
              <option value="">全て</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="案件番号"><input value={f.caseNumber} onChange={set('caseNumber')} /></Field>
        </div>

        <table>
          <thead>
            <tr>
              <th>在庫番号</th><th>商品名</th><th>グレード</th>
              <th className="num">買取金額</th><th className="num">見込金額（社内）</th>
              <th>販路</th><th>ステータス</th><th>仕入日</th><th>案件番号</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/inventory/${it.id}`)}>
                <td>{it.inventoryNumber}</td>
                <td>{it.name}</td>
                <td>{it.grade === 'NONE' ? 'なし' : it.grade}</td>
                <td className="num">{yen(it.purchaseAmount)}</td>
                <td className="num">{yen(it.expectedAmount)}</td>
                <td>{it.salesChannel || '-'}</td>
                <td><InventoryBadge status={it.status} /></td>
                <td>{date(it.stockedAt)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {it.sourceCase
                    ? <Link to={`/cases/${it.sourceCase.id}`}>{it.sourceCase.caseNumber}</Link>
                    : '-'}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={9} className="muted">在庫がありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
