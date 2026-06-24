import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { yen } from '../lib/format';
import { ID_DOCUMENT_LABEL, VERIFICATION_METHOD_LABEL } from '../types';

export default function SignPage() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'review' | 'identity' | 'sign' | 'done'>('review');
  const [idForm, setIdForm] = useState<any>({ method: '', documentType: 'DRIVERS_LICENSE', imageUrl: '' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const load = () => api.get<any>(`/api/public/contracts/${token}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (data && step === 'review') {
      const delivery = data.snapshot?.purchaseMethod === 'DELIVERY';
      setIdForm((f: any) => ({ ...f, method: delivery ? 'NONFACE_ID_IMAGE_PLUS' : 'FACE_TO_FACE' }));
    }
  }, [data, step]);

  if (error) return <div className="center-screen"><div className="card login-box"><div className="error">{error}</div></div></div>;
  if (!data) return <div className="center-screen">読み込み中...</div>;
  const s = data.snapshot;

  if (data.signed || step === 'done') {
    return (
      <div className="center-screen">
        <div className="card login-box" style={{ textAlign: 'center' }}>
          <h2>ご契約ありがとうございました</h2>
          <p>契約書の控えは以下からご確認いただけます。</p>
          <a href={`${api.baseUrl}/api/public/contracts/${token}/pdf`} target="_blank" rel="noreferrer"><button>契約書PDFを開く</button></a>
        </div>
      </div>
    );
  }

  // canvas handlers
  const pos = (e: any) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };
  const start = (e: any) => { drawing.current = true; const ctx = canvasRef.current!.getContext('2d')!; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const move = (e: any) => { if (!drawing.current) return; e.preventDefault(); const ctx = canvasRef.current!.getContext('2d')!; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.lineWidth = 2; ctx.stroke(); };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); };

  const submitIdentity = async () => {
    try {
      await api.post(`/api/public/contracts/${token}/identity`, idForm);
      setStep('sign');
    } catch (e: any) { setError(e.message); }
  };
  const submitSign = async () => {
    try {
      const imageData = canvasRef.current!.toDataURL('image/png');
      await api.post(`/api/public/contracts/${token}/sign`, { imageData });
      setStep('done');
      load();
    } catch (e: any) { setError(e.message); }
  };

  const delivery = s?.purchaseMethod === 'DELIVERY';
  const methods = delivery
    ? ['NONFACE_REGISTERED_MAIL', 'NONFACE_ID_IMAGE_PLUS', 'NONFACE_IC_CHIP', 'NONFACE_E_SIGNATURE']
    : Object.keys(VERIFICATION_METHOD_LABEL);

  return (
    <div style={{ maxWidth: 560, margin: '20px auto', padding: '0 14px' }}>
      <h2>古物売買契約書のご確認</h2>

      {step === 'review' && (
        <div className="card">
          <div><b>{s.customer.name} 様</b></div>
          <div>{s.customer.address}</div>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>商品名</th><th>数量</th><th className="num">買取金額</th></tr></thead>
            <tbody>{s.items.map((i: any, idx: number) => (
              <tr key={idx}><td>{i.name}</td><td>{i.quantity}</td><td className="num">{yen(i.amount)}</td></tr>))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 16 }}>
            <b>{s.payable >= 0 ? 'お支払額' : 'ご請求額'}：{yen(Math.abs(s.payable))}</b>
          </div>
          {s.customerMessage && <p className="muted">{s.customerMessage}</p>}
          <button style={{ marginTop: 12 }} onClick={() => setStep('identity')}>同意して本人確認へ進む</button>
        </div>
      )}

      {step === 'identity' && (
        <div className="card">
          <h3>本人確認</h3>
          {delivery && <p className="badge amber">宅配のお取引では、画像送信に加え法令に定める方法での確認が必要です。</p>}
          <label>確認方法</label>
          <select value={idForm.method} onChange={(e) => setIdForm({ ...idForm, method: e.target.value })}>
            {methods.map((m) => <option key={m} value={m}>{VERIFICATION_METHOD_LABEL[m]}</option>)}
          </select>
          <label style={{ marginTop: 10 }}>身分証種別</label>
          <select value={idForm.documentType} onChange={(e) => setIdForm({ ...idForm, documentType: e.target.value })}>
            {Object.entries(ID_DOCUMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label style={{ marginTop: 10 }}>身分証の画像</label>
          <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setIdForm({ ...idForm, imageUrl: await toDataUrl(f) }); }} />
          <button style={{ marginTop: 12 }} onClick={submitIdentity} disabled={!idForm.imageUrl}>本人確認を送信</button>
        </div>
      )}

      {step === 'sign' && (
        <div className="card">
          <h3>署名</h3>
          <p className="muted">下の枠内に署名してください。</p>
          <canvas
            ref={canvasRef}
            width={500}
            height={180}
            className="signpad"
            style={{ width: '100%', maxWidth: 500 }}
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn-sub" onClick={clear}>クリア</button>
            <button onClick={submitSign}>署名して契約を確定</button>
          </div>
        </div>
      )}
    </div>
  );
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}
