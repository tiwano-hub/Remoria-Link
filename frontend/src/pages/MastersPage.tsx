import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Field } from '../components/ui';
import { date } from '../lib/format';

export default function MastersPage() {
  const [m, setM] = useState<any>({ taxRates: [], channels: [], sources: [], locations: [], stores: [] });
  const [error, setError] = useState('');

  const [taxForm, setTaxForm] = useState({ label: '', rate: '', effectiveFrom: '', isDefault: false });
  const [channelName, setChannelName] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [storeForm, setStoreForm] = useState({ code: '', name: '' });

  const reload = () => {
    api.get<any>('/api/masters').then(setM).catch((e) => setError(e.message));
  };

  useEffect(reload, []);

  const run = (p: Promise<any>) => {
    setError('');
    p.then(reload).catch((e) => setError(e.message));
  };

  const addTaxRate = () => {
    run(api.post<any>('/api/masters/tax-rates', {
      rate: Number(taxForm.rate) / 100,
      label: taxForm.label,
      effectiveFrom: taxForm.effectiveFrom,
      isDefault: taxForm.isDefault,
    }));
    setTaxForm({ label: '', rate: '', effectiveFrom: '', isDefault: false });
  };

  return (
    <div>
      <h2>マスタ管理</h2>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>税率</h3>
        <p className="muted">金額はすべて税込入力。初期値10%。</p>
        <table>
          <thead>
            <tr><th>ラベル</th><th className="num">税率</th><th>適用開始日</th><th>既定</th></tr>
          </thead>
          <tbody>
            {m.taxRates.map((t: any) => (
              <tr key={t.id}>
                <td>{t.label}</td>
                <td className="num">{Math.round(Number(t.rate) * 100)}%</td>
                <td>{date(t.effectiveFrom)}</td>
                <td>{t.isDefault && <span className="badge green">既定</span>}</td>
              </tr>
            ))}
            {m.taxRates.length === 0 && <tr><td colSpan={4} className="muted">税率がありません</td></tr>}
          </tbody>
        </table>
        <div className="divider" />
        <div className="toolbar">
          <Field label="ラベル"><input value={taxForm.label} onChange={(e) => setTaxForm({ ...taxForm, label: e.target.value })} /></Field>
          <Field label="税率(%)"><input type="number" value={taxForm.rate} onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })} /></Field>
          <Field label="適用開始日"><input type="date" value={taxForm.effectiveFrom} onChange={(e) => setTaxForm({ ...taxForm, effectiveFrom: e.target.value })} /></Field>
          <Field label="既定にする">
            <input type="checkbox" checked={taxForm.isDefault} onChange={(e) => setTaxForm({ ...taxForm, isDefault: e.target.checked })} />
          </Field>
          <button className="btn-sub" onClick={addTaxRate}>追加</button>
        </div>
      </div>

      <div className="card">
        <h3>販路</h3>
        <table>
          <thead><tr><th>名称</th><th>操作</th></tr></thead>
          <tbody>
            {m.channels.map((c: any) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><button className="btn-sm btn-danger" onClick={() => run(api.del<any>(`/api/masters/channels/${c.id}`))}>削除</button></td>
              </tr>
            ))}
            {m.channels.length === 0 && <tr><td colSpan={2} className="muted">販路がありません</td></tr>}
          </tbody>
        </table>
        <div className="divider" />
        <div className="toolbar">
          <Field label="名称"><input value={channelName} onChange={(e) => setChannelName(e.target.value)} /></Field>
          <button className="btn-sub" onClick={() => { run(api.post<any>('/api/masters/channels', { name: channelName })); setChannelName(''); }}>追加</button>
        </div>
      </div>

      <div className="card">
        <h3>反響経路</h3>
        <table>
          <thead><tr><th>名称</th><th>操作</th></tr></thead>
          <tbody>
            {m.sources.map((s: any) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><button className="btn-sm btn-danger" onClick={() => run(api.del<any>(`/api/masters/sources/${s.id}`))}>削除</button></td>
              </tr>
            ))}
            {m.sources.length === 0 && <tr><td colSpan={2} className="muted">反響経路がありません</td></tr>}
          </tbody>
        </table>
        <div className="divider" />
        <div className="toolbar">
          <Field label="名称"><input value={sourceName} onChange={(e) => setSourceName(e.target.value)} /></Field>
          <button className="btn-sub" onClick={() => { run(api.post<any>('/api/masters/sources', { name: sourceName })); setSourceName(''); }}>追加</button>
        </div>
      </div>

      <div className="card">
        <h3>保管場所</h3>
        <table>
          <thead><tr><th>名称</th><th>操作</th></tr></thead>
          <tbody>
            {m.locations.map((l: any) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td><button className="btn-sm btn-danger" onClick={() => run(api.del<any>(`/api/masters/locations/${l.id}`))}>削除</button></td>
              </tr>
            ))}
            {m.locations.length === 0 && <tr><td colSpan={2} className="muted">保管場所がありません</td></tr>}
          </tbody>
        </table>
        <div className="divider" />
        <div className="toolbar">
          <Field label="名称"><input value={locationName} onChange={(e) => setLocationName(e.target.value)} /></Field>
          <button className="btn-sub" onClick={() => { run(api.post<any>('/api/masters/locations', { name: locationName })); setLocationName(''); }}>追加</button>
        </div>
      </div>

      <div className="card">
        <h3>店舗</h3>
        <p className="muted">在庫番号は店舗コードで採番（例 KOBE-20260624-0001）。</p>
        <table>
          <thead><tr><th>コード</th><th>名称</th></tr></thead>
          <tbody>
            {m.stores.map((s: any) => (
              <tr key={s.id}>
                <td>{s.code}</td>
                <td>{s.name}</td>
              </tr>
            ))}
            {m.stores.length === 0 && <tr><td colSpan={2} className="muted">店舗がありません</td></tr>}
          </tbody>
        </table>
        <div className="divider" />
        <div className="toolbar">
          <Field label="コード"><input value={storeForm.code} onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })} /></Field>
          <Field label="名称"><input value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} /></Field>
          <button className="btn-sub" onClick={() => { run(api.post<any>('/api/masters/stores', { code: storeForm.code, name: storeForm.name })); setStoreForm({ code: '', name: '' }); }}>追加</button>
        </div>
      </div>
    </div>
  );
}
