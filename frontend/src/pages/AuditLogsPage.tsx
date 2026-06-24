import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Field } from '../components/ui';
import { datetime } from '../lib/format';
import { User } from '../types';

const ACTION_LABEL: Record<string, string> = {
  CASE_CREATE: '案件作成',
  CASE_UPDATE: '案件編集',
  CONTRACT_ISSUE: '契約書発行',
  SIGNATURE_COMPLETE: '署名完了',
  IDENTITY_REGISTER: '身分証登録',
  AMOUNT_CHANGE: '金額変更',
  INVENTORY_REGISTER: '在庫登録',
  SALE_REGISTER: '販売登録',
  RECEIPT_ISSUE: '領収書発行',
  DEPOSIT_REGISTER: '入金登録',
  WITHDRAWAL_REGISTER: '出金登録',
  DELETE: '削除操作',
  LOGIN: 'ログイン',
};

export default function AuditLogsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [f, setF] = useState({ caseNumber: '', action: '', userId: '' });

  useEffect(() => {
    api.get<User[]>('/api/users').then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    setError('');
    api.get<any[]>(`/api/audit-logs?${qs.toString()}`)
      .then(setRows)
      .catch((e: any) => {
        setRows([]);
        setError(/403/.test(String(e?.message)) ? '権限がありません' : String(e?.message || 'エラー'));
      });
  }, [f]);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <h2>操作ログ</h2>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="toolbar">
          <Field label="案件番号"><input value={f.caseNumber} onChange={set('caseNumber')} /></Field>
          <Field label="操作">
            <select value={f.action} onChange={set('action')}>
              <option value="">全て</option>
              {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="操作者">
            <select value={f.userId} onChange={set('userId')}>
              <option value="">全て</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>

        <table>
          <thead>
            <tr>
              <th>操作日時</th><th>操作者</th><th>操作</th>
              <th>内容</th><th>対象案件</th><th>IPアドレス</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{datetime(r.createdAt)}</td>
                <td>{r.user ? `${r.user.name}（${r.user.email}）` : '-'}</td>
                <td>{ACTION_LABEL[r.action] || r.action}</td>
                <td>{r.description || '-'}</td>
                <td>{r.caseNumber || '-'}</td>
                <td>{r.ipAddress || '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">操作ログがありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
