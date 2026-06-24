import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export default function LoginPage() {
  const { user, loginWithGoogle, devLogin } = useAuth();
  const navigate = useNavigate();
  const btnRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/cases');
  }, [user, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const init = () => {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            await loginWithGoogle(resp.credential);
            navigate('/cases');
          } catch (e: any) {
            setError(e.message);
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'large', width: 320 });
    };
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [loginWithGoogle, navigate]);

  const handleDev = async () => {
    try {
      await devLogin(email);
      navigate('/cases');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="center-screen">
      <div className="card login-box">
        <h2 style={{ textAlign: 'center' }}>Remoria Link</h2>
        <p className="muted" style={{ textAlign: 'center' }}>出張買取 業務管理システム</p>
        {error && <div className="error">{error}</div>}

        {GOOGLE_CLIENT_ID ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }} ref={btnRef} />
        ) : (
          <p className="muted">Google クライアントID 未設定のため、開発用ログインを使用します。</p>
        )}

        <div className="divider" />
        <label>開発用ログイン（メールアドレス）</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
        <button style={{ width: '100%', marginTop: 10 }} onClick={handleDev}>
          ログイン
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          初回ログインのユーザーは自動的に管理者になります。
        </p>
      </div>
    </div>
  );
}
