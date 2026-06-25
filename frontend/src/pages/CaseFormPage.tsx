import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Field } from '../components/ui';
import { User } from '../types';

const HOURS = Array.from({ length: 17 }, (_, i) => (i * 0.5).toFixed(1)); // 0.0〜8.0

// 現在日時を datetime-local 入力用の文字列(YYYY-MM-DDTHH:mm)に変換
const nowLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function CaseFormPage() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: { phone?: string; customer?: any } };

  const [users, setUsers] = useState<User[]>([]);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [customer, setCustomer] = useState<any>({
    name: '', nameKana: '', phone: '', email: '', postalCode: '',
    prefecture: '', city: '', address: '', building: '', customerType: 'NEW',
  });
  const [cs, setCs] = useState<any>({
    status: 'INQUIRY', purchaseMethod: 'VISIT', appointmentRank: '',
    referralSource: '', bookerId: '', appraiserId: '', workerId: '',
    reservedAt: '', appraisalAt: '', workAt: '', contractAt: '',
    appraisalHours: '', workHours: '', internalMemo: '', customerMessage: '',
  });

  useEffect(() => {
    api.get<User[]>('/api/users').then(setUsers).catch(() => {});
    api.get<any>('/api/masters').then((m) => setSources(m.sources)).catch(() => {});
  }, []);

  useEffect(() => {
    if (state?.customer) {
      setCustomer((c: any) => ({ ...c, ...state.customer, phone: state.customer.phone || state.phone || '' }));
    } else if (state?.phone) {
      setCustomer((c: any) => ({ ...c, phone: state.phone }));
    }
  }, [state]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving || !customer.name || !customer.phone) return;
    setError('');
    setSaving(true);
    try {
      const caseInput: any = {};
      for (const [k, v] of Object.entries(cs)) {
        if (v === '' || v == null) continue;
        if (k === 'appraisalHours' || k === 'workHours') caseInput[k] = Number(v);
        else caseInput[k] = v;
      }
      const created = await api.post<{ id: string }>('/api/cases', { customer, case: caseInput });
      navigate(`/cases/${created.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const cf = (k: string) => (e: any) => setCustomer({ ...customer, [k]: e.target.value });
  const sf = (k: string) => (e: any) => setCs({ ...cs, [k]: e.target.value });

  // ステータスを「予約中」にした瞬間、予約日に現在日時を自動セット
  const onStatusChange = (e: any) => {
    const status = e.target.value;
    setCs((prev: any) => {
      const next = { ...prev, status };
      if (status === 'RESERVED' && prev.status !== 'RESERVED') next.reservedAt = nowLocal();
      return next;
    });
  };

  return (
    <div>
      <h2>案件登録</h2>
      {error && <div className="error">{error}</div>}

      <form onSubmit={submit}>
      <div className="card">
        <h3>顧客情報</h3>
        <div className="grid3">
          <Field label="顧客名"><input value={customer.name} onChange={cf('name')} /></Field>
          <Field label="顧客名カナ"><input value={customer.nameKana} onChange={cf('nameKana')} /></Field>
          <Field label="電話番号"><input value={customer.phone} onChange={cf('phone')} /></Field>
          <Field label="メールアドレス"><input value={customer.email} onChange={cf('email')} /></Field>
          <Field label="郵便番号"><input value={customer.postalCode} onChange={cf('postalCode')} /></Field>
          <Field label="都道府県"><input value={customer.prefecture} onChange={cf('prefecture')} /></Field>
          <Field label="市区町村"><input value={customer.city} onChange={cf('city')} /></Field>
          <Field label="住所"><input value={customer.address} onChange={cf('address')} /></Field>
          <Field label="マンション名・部屋番号"><input value={customer.building} onChange={cf('building')} /></Field>
          <Field label="顧客種別">
            <select value={customer.customerType} onChange={cf('customerType')}>
              <option value="NEW">新規</option>
              <option value="REPEATER">リピーター</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="card">
        <h3>案件情報</h3>
        <div className="grid3">
          <Field label="ステータス">
            <select value={cs.status} onChange={onStatusChange}>
              {['INQUIRY','RESERVED','APPRAISING','APPROVED','EXECUTED','COMPLETED','CONSIDERING','CANCELLED'].map((s) => (
                <option key={s} value={s}>{({INQUIRY:'問合中',RESERVED:'予約中',APPRAISING:'査定中',APPROVED:'承認済',EXECUTED:'実施済',COMPLETED:'完了',CONSIDERING:'検討中',CANCELLED:'中止'} as any)[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="買取方法">
            <select value={cs.purchaseMethod} onChange={sf('purchaseMethod')}>
              <option value="VISIT">出張</option><option value="DELIVERY">宅配</option><option value="STORE">店頭</option>
            </select>
          </Field>
          <Field label="アポランク">
            <select value={cs.appointmentRank} onChange={sf('appointmentRank')}>
              <option value="">-</option>
              {['A','B','C','D','E','F'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="反響経路">
            <select value={cs.referralSource} onChange={sf('referralSource')}>
              <option value="">-</option>
              {sources.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="予約担当者">
            <select value={cs.bookerId} onChange={sf('bookerId')}>
              <option value="">-</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="査定担当者">
            <select value={cs.appraiserId} onChange={sf('appraiserId')}>
              <option value="">-</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="作業担当者">
            <select value={cs.workerId} onChange={sf('workerId')}>
              <option value="">-</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="予約日"><input type="datetime-local" value={cs.reservedAt} onChange={sf('reservedAt')} /></Field>
          <Field label="査定日"><input type="datetime-local" value={cs.appraisalAt} onChange={sf('appraisalAt')} /></Field>
          <Field label="査定時間（h）">
            <select value={cs.appraisalHours} onChange={sf('appraisalHours')}>
              <option value="">-</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="作業日"><input type="datetime-local" value={cs.workAt} onChange={sf('workAt')} /></Field>
          <Field label="作業時間（h）">
            <select value={cs.workHours} onChange={sf('workHours')}>
              <option value="">-</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="契約日"><input type="datetime-local" value={cs.contractAt} onChange={sf('contractAt')} /></Field>
        </div>
        <Field label="社内メモ（顧客非表示）"><textarea rows={2} value={cs.internalMemo} onChange={sf('internalMemo')} /></Field>
        <Field label="顧客向けメッセージ"><textarea rows={2} value={cs.customerMessage} onChange={sf('customerMessage')} /></Field>
      </div>

      <button type="submit" disabled={saving || !customer.name || !customer.phone}>
        {saving ? '登録中...' : '案件を登録'}
      </button>
      </form>
    </div>
  );
}
