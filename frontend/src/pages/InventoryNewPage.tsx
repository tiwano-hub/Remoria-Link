import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Field } from '../components/ui';
import { GRADES, Grade, User } from '../types';

export default function InventoryNewPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<{ name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<any>({
    name: '', quantity: 1, grade: 'NONE', salesChannel: '',
    purchaseAmount: 0, expectedAmount: 0, storageLocation: '',
    appraiserId: '', note: '',
  });

  useEffect(() => {
    api.get<User[]>('/api/users').then(setUsers).catch(() => {});
    api.get<any>('/api/masters').then((m) => { setChannels(m.channels); setLocations(m.locations); }).catch(() => {});
  }, []);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError('');
    setSaving(true);
    try {
      const body: any = {
        name: form.name,
        grade: form.grade,
        salesChannel: form.salesChannel,
        quantity: Number(form.quantity),
        purchaseAmount: Number(form.purchaseAmount),
        expectedAmount: Number(form.expectedAmount),
      };
      if (form.storageLocation) body.storageLocation = form.storageLocation;
      if (form.appraiserId) body.appraiserId = form.appraiserId;
      if (form.note) body.note = form.note;
      const created = await api.post<{ id: string }>('/api/inventory', body);
      navigate(`/inventory/${created.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || !form.name || !form.grade || !form.salesChannel;

  return (
    <div>
      <h2>在庫登録</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <p className="muted">金額はすべて税込で入力してください。</p>
        <div className="grid3">
          <Field label="商品名"><input value={form.name} onChange={set('name')} /></Field>
          <Field label="数量"><input type="number" value={form.quantity} onChange={set('quantity')} /></Field>
          <Field label="グレード">
            <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as Grade })}>
              {GRADES.map((g) => <option key={g} value={g}>{g === 'NONE' ? 'なし' : g}</option>)}
            </select>
          </Field>
          <Field label="販路">
            <select value={form.salesChannel} onChange={set('salesChannel')}>
              <option value="">-</option>
              {channels.map((ch) => <option key={ch.name} value={ch.name}>{ch.name}</option>)}
            </select>
          </Field>
          <Field label="買取金額（税込）"><input type="number" value={form.purchaseAmount} onChange={set('purchaseAmount')} /></Field>
          <Field label="見込金額（税込・社内）"><input type="number" value={form.expectedAmount} onChange={set('expectedAmount')} /></Field>
          <Field label="保管場所">
            <select value={form.storageLocation} onChange={set('storageLocation')}>
              <option value="">-</option>
              {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="査定担当者">
            <select value={form.appraiserId} onChange={set('appraiserId')}>
              <option value="">-</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="備考"><textarea rows={2} value={form.note} onChange={set('note')} /></Field>
      </div>

      <button onClick={submit} disabled={disabled}>
        {saving ? '登録中...' : '在庫を登録'}
      </button>
    </div>
  );
}
