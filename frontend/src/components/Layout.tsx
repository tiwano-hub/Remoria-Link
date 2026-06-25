import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../types';

const nav = [
  { group: '案件' },
  { to: '/intake', label: '電話番号入力' },
  { to: '/cases', label: '案件一覧' },
  { group: '在庫・販売' },
  { to: '/inventory', label: '在庫一覧' },
  { to: '/inventory/new', label: '在庫登録' },
  { to: '/sales', label: '販売実績' },
  { group: '入出金' },
  { to: '/payments', label: '入出金管理' },
  { to: '/receipts', label: '電子領収書' },
  { group: '分析' },
  { to: '/analytics/purchase', label: '買取分析' },
  { to: '/analytics/sales', label: '販売分析' },
  { group: '管理' },
  { to: '/users', label: 'ユーザー管理' },
  { to: '/masters', label: 'マスタ管理' },
  { to: '/audit-logs', label: '操作ログ' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="app">
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="logo">Remoria <span>Link</span></div>
        <nav>
          {nav.map((n, i) =>
            'group' in n ? (
              <div className="group" key={`g${i}`}>{n.group}</div>
            ) : (
              <NavLink
                key={n.to}
                to={n.to!}
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}
                end={n.to === '/cases'}
              >
                {n.label}
              </NavLink>
            ),
          )}
        </nav>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button className="hamburger" aria-label="メニュー" onClick={() => setOpen(true)}>☰</button>
            <div className="topbar-brand">Remoria <span>Link</span></div>
          </div>
          <div className="user">
            <span className="user-name">{user?.name}（{user ? ROLE_LABEL[user.role] : ''}）</span>
            {' '}
            <button className="btn-sub btn-sm" onClick={() => { logout(); navigate('/login'); }}>
              ログアウト
            </button>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
