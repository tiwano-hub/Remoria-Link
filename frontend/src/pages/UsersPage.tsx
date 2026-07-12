import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ROLE_LABEL, Role } from '../types';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');

  const reload = () => {
    api.get<any[]>('/api/users').then(setUsers).catch((e) => setError(e.message));
  };

  useEffect(reload, []);

  const save = (id: string, body: any) => {
    setError('');
    api.put<any>(`/api/users/${id}`, body)
      .then(reload)
      .catch((e) => setError(e.message));
  };

  const del = (u: any) => {
    if (!confirm(`${u.name}（${u.email}）を削除しますか？\nこの操作は取り消せません。`)) return;
    setError('');
    api.del(`/api/users/${u.id}`)
      .then(reload)
      .catch((e) => setError(e.message));
  };

  return (
    <div>
      <h2>ユーザー管理</h2>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>氏名</th><th>メール</th><th>権限</th><th>店舗</th><th>状態</th><th>カレンダーID</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => save(u.id, { role: e.target.value as Role })}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </td>
                <td>{u.store?.name || '-'}</td>
                <td>
                  <button
                    className={`btn-sm ${u.active ? 'btn-sub' : 'btn-danger'}`}
                    onClick={() => save(u.id, { active: !u.active })}
                  >
                    {u.active ? '有効' : '無効'}
                  </button>
                </td>
                <td>
                  <input
                    defaultValue={u.calendarId || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (u.calendarId || '')) save(u.id, { calendarId: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <button className="btn-danger btn-sm" onClick={() => del(u)}>削除</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={7} className="muted">ユーザーがいません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
