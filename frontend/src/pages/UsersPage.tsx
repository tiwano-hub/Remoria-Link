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
    if (!confirm(`${u.name}（${u.email}）を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    setError('');
    api.del(`/api/users/${u.id}`)
      .then(reload)
      .catch((e) => setError(e.message));
  };

  return (
    <div>
      <h2>ユーザー管理</h2>
      {error && <div className="error">{error}</div>}

      {users.length === 0 && <p className="muted">ユーザーがいません</p>}

      {users.map((u) => (
        <div key={u.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div>
              <b>{u.name}</b>{!u.active && <span className="badge red" style={{ marginLeft: 8 }}>無効</span>}
              <div className="muted" style={{ fontSize: 13 }}>{u.email}</div>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>{u.store?.name || '-'}</div>
          </div>

          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label>権限</label>
              <select value={u.role} onChange={(e) => save(u.id, { role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label>カレンダーID</label>
              <input
                defaultValue={u.calendarId || ''}
                onBlur={(e) => { if (e.target.value !== (u.calendarId || '')) save(u.id, { calendarId: e.target.value }); }}
              />
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn-sub btn-sm" onClick={() => save(u.id, { active: !u.active })}>
              {u.active ? '無効にする' : '有効にする'}
            </button>
            <button className="btn-danger btn-sm" onClick={() => del(u)}>完全に削除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
