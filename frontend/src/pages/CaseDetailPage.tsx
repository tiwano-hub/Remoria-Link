import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Field, Internal, StatusBadge } from '../components/ui';
import { yen, datetime, date, pct } from '../lib/format';
import {
  CASE_STATUS_LABEL, PURCHASE_METHOD_LABEL, GRADES, Grade, User,
  VERIFICATION_METHOD_LABEL, ID_DOCUMENT_LABEL,
} from '../types';

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<{ name: string }[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('items');

  const load = useCallback(() => {
    api.get<any>(`/api/cases/${id}`).then(setC).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    api.get<User[]>('/api/users').then(setUsers).catch(() => {});
    api.get<any>('/api/masters').then((m) => setChannels(m.channels)).catch(() => {});
  }, [load]);

  if (error) return <div className="error">{error}</div>;
  if (!c) return <div className="muted">読み込み中...</div>;

  const t = c.totals;

  const saveField = async (patch: any) => {
    await api.put(`/api/cases/${id}`, patch);
    load();
  };

  // 入力欄でEnterを押したら確定（blur→onBlur保存が走る）
  const saveOnEnter = (e: any) => { if (e.key === 'Enter') e.currentTarget.blur(); };

  const autoStock = async () => {
    const r = await api.post<{ created: any[] }>(`/api/inventory/from-case/${id}`);
    alert(`${r.created.length} 件を在庫登録しました`);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{c.caseNumber}　<StatusBadge status={c.status} /></h2>
        <div className="row">
          <Link to={`/cases/${id}/contract`}><button className="btn-sub">契約書作成</button></Link>
          <button className="btn-sub" onClick={autoStock}>買取品を在庫登録</button>
        </div>
      </div>

      <div className="grid2">
        {/* 顧客情報 */}
        <div className="card">
          <h3>顧客情報</h3>
          <div><b>{c.customer.name}</b>（{c.customer.nameKana}）</div>
          <div className="muted">{c.customer.customerType === 'REPEATER' ? 'リピーター' : '新規'}</div>
          <div>{c.customer.phone}　{c.customer.email}</div>
          <div>〒{c.customer.postalCode} {c.customer.prefecture}{c.customer.city}{c.customer.address} {c.customer.building}</div>
        </div>

        {/* 案件情報 */}
        <div className="card">
          <h3>案件情報</h3>
          <div className="grid2">
            <Field label="ステータス">
              <select
                value={c.status}
                onChange={(e) => {
                  const status = e.target.value;
                  const patch: any = { status };
                  // 「予約中」にした瞬間、予約日が未設定なら現在日時を自動登録
                  if (status === 'RESERVED' && !c.reservedAt) patch.reservedAt = new Date().toISOString();
                  saveField(patch);
                }}
              >
                {Object.entries(CASE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="買取方法">
              <select value={c.purchaseMethod || ''} onChange={(e) => saveField({ purchaseMethod: e.target.value })}>
                {Object.entries(PURCHASE_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="査定担当者">
              <select value={c.appraiserId || ''} onChange={(e) => saveField({ appraiserId: e.target.value || null })}>
                <option value="">-</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="作業担当者">
              <select value={c.workerId || ''} onChange={(e) => saveField({ workerId: e.target.value || null })}>
                <option value="">-</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="予約日"><input key={`r${c.reservedAt || ''}`} type="datetime-local" defaultValue={localv(c.reservedAt)} onKeyDown={saveOnEnter} onBlur={(e) => saveField({ reservedAt: e.target.value || null })} /></Field>
            <Field label="査定日"><input type="datetime-local" defaultValue={localv(c.appraisalAt)} onKeyDown={saveOnEnter} onBlur={(e) => saveField({ appraisalAt: e.target.value || null })} /></Field>
            <Field label="作業日"><input type="datetime-local" defaultValue={localv(c.workAt)} onKeyDown={saveOnEnter} onBlur={(e) => saveField({ workAt: e.target.value || null })} /></Field>
            <Field label="契約日"><input type="datetime-local" defaultValue={localv(c.contractAt)} onKeyDown={saveOnEnter} onBlur={(e) => saveField({ contractAt: e.target.value || null })} /></Field>
          </div>
          <Field label="社内メモ（顧客非表示）"><textarea rows={2} defaultValue={c.internalMemo || ''} onBlur={(e) => saveField({ internalMemo: e.target.value })} /></Field>
        </div>
      </div>

      {/* 粗利パネル（社内） */}
      <div className="card">
        <h3>粗利計算 <Internal>非公開</Internal></h3>
        <div className="grid4">
          <Kpi label="買取金額合計" v={yen(t.purchaseTotal)} />
          <Kpi label="案件オプション合計" v={yen(t.caseOptionTotal)} />
          <Kpi label="原価オプション合計" v={yen(t.costOptionTotal)} />
          <Kpi label="見込金額合計" v={yen(t.expectedTotal)} />
          <Kpi label="顧客への支払額" v={yen(t.customerPayable)} />
          <Kpi label="顧客からの受領額" v={yen(c.settlement?.customerReceipt ?? 0)} />
          <Kpi label="見込粗利" v={yen(t.expectedGrossProfit)} />
          <Kpi label="見込原価率" v={pct(t.expectedCostRate)} />
        </div>
      </div>

      <div className="pill-tabs">
        {[['items','買取品明細'],['options','オプション'],['identity','本人確認'],['contracts','契約書'],['receipts','領収書'],['payments','入出金・精算']].map(([k,l]) => (
          <button key={k} className={tab===k?'active':''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'items' && <ItemsTab c={c} channels={channels} reload={load} />}
      {tab === 'options' && <OptionsTab c={c} reload={load} />}
      {tab === 'identity' && <IdentityTab c={c} users={users} reload={load} />}
      {tab === 'contracts' && <ContractsTab c={c} reload={load} navigate={navigate} />}
      {tab === 'receipts' && <ReceiptsTab c={c} reload={load} />}
      {tab === 'payments' && <PaymentsTab c={c} reload={load} />}
    </div>
  );
}

const localv = (d: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function Kpi({ label, v }: { label: string; v: any }) {
  return <div className="kpi"><div className="label">{label}</div><div className="value">{v}</div></div>;
}

// ---------------- 買取品明細 ----------------
function ItemsTab({ c, channels, reload }: any) {
  const [form, setForm] = useState<any>({ name: '', quantity: 1, grade: 'NONE', purchaseAmount: 0, expectedAmount: 0, salesChannel: '', note: '' });
  const add = async () => {
    await api.post('/api/items', { ...form, caseId: c.id, quantity: Number(form.quantity), purchaseAmount: Number(form.purchaseAmount), expectedAmount: Number(form.expectedAmount) });
    setForm({ name: '', quantity: 1, grade: 'NONE', purchaseAmount: 0, expectedAmount: 0, salesChannel: '', note: '' });
    reload();
  };
  const markLost = async (it: any) => {
    const reason = prompt('失点理由を入力してください');
    if (reason === null) return;
    await api.post(`/api/items/${it.id}/lost`, { reason });
    reload();
  };
  const addPhoto = async (it: any, forContract: boolean) => {
    const file = await pickFile();
    if (!file) return;
    await api.post(`/api/items/${it.id}/photos`, { url: file, forContract });
    reload();
  };

  return (
    <div className="card">
      <h3>買取品明細（金額はすべて税込）</h3>
      <table>
        <thead>
          <tr><th>商品名</th><th>数量</th><th>グレード</th><th className="num">買取金額</th><th className="num">見込金額 <Internal /></th><th>販路 <Internal /></th><th>写真</th><th></th></tr>
        </thead>
        <tbody>
          {c.purchaseItems.map((it: any) => (
            <tr key={it.id} style={it.isLost ? { opacity: 0.5 } : undefined}>
              <td>{it.name}{it.isLost && <span className="badge red" style={{ marginLeft: 6 }}>失点</span>}</td>
              <td>{it.quantity}</td>
              <td>{it.grade}</td>
              <td className="num">{yen(it.purchaseAmount)}</td>
              <td className="num">{yen(it.expectedAmount)}</td>
              <td>{it.salesChannel || '-'}</td>
              <td>
                {it.photos?.filter((p:any)=>p.forContract).length || 0}/契約　{it.photos?.filter((p:any)=>!p.forContract).length || 0}/社内
                <div>
                  <button className="btn-sub btn-sm" onClick={() => addPhoto(it, true)}>契約用</button>{' '}
                  <button className="btn-sub btn-sm" onClick={() => addPhoto(it, false)}>社内用</button>
                </div>
              </td>
              <td>{!it.isLost && <button className="btn-danger btn-sm" onClick={() => markLost(it)}>失点</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="divider" />
      <h3>明細を追加</h3>
      <div className="grid4">
        <Field label="商品名"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="数量"><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
        <Field label="グレード"><select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as Grade })}>{GRADES.map((g) => <option key={g} value={g}>{g === 'NONE' ? 'なし' : g}</option>)}</select></Field>
        <Field label="販路（社内）"><select value={form.salesChannel} onChange={(e) => setForm({ ...form, salesChannel: e.target.value })}><option value="">-</option>{channels.map((ch: any) => <option key={ch.name} value={ch.name}>{ch.name}</option>)}</select></Field>
        <Field label="買取金額（税込）"><input type="number" value={form.purchaseAmount} onChange={(e) => setForm({ ...form, purchaseAmount: e.target.value })} /></Field>
        <Field label="見込金額（税込・社内）"><input type="number" value={form.expectedAmount} onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })} /></Field>
        <Field label="備考"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
      <button onClick={add} disabled={!form.name}>明細を追加</button>
    </div>
  );
}

// ---------------- オプション ----------------
function OptionsTab({ c, reload }: any) {
  const [co, setCo] = useState<any>({ name: '', quantity: 1, amount: 0, deductible: true });
  const [ro, setRo] = useState<any>({ name: '', quantity: 1, amount: 0 });
  const addCase = async () => { await api.post('/api/options/case-options', { ...co, caseId: c.id, quantity: Number(co.quantity), amount: Number(co.amount) }); setCo({ name: '', quantity: 1, amount: 0, deductible: true }); reload(); };
  const addCost = async () => { await api.post('/api/options/cost-options', { ...ro, caseId: c.id, quantity: Number(ro.quantity), amount: Number(ro.amount) }); setRo({ name: '', quantity: 1, amount: 0 }); reload(); };

  return (
    <div className="grid2">
      <div className="card">
        <h3>案件オプション（顧客費用・契約書表示）</h3>
        <table><thead><tr><th>名称</th><th>数量</th><th className="num">税込金額</th><th>差引</th><th></th></tr></thead>
          <tbody>{c.caseOptions.map((o: any) => (
            <tr key={o.id}><td>{o.name}</td><td>{o.quantity}</td><td className="num">{yen(o.amount)}</td><td>{o.deductible ? '対象' : '-'}</td>
              <td><button className="btn-danger btn-sm" onClick={async () => { await api.del(`/api/options/case-options/${o.id}`); reload(); }}>削除</button></td></tr>))}
          </tbody></table>
        <div className="grid2" style={{ marginTop: 10 }}>
          <Field label="名称"><input value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} placeholder="作業費 等" /></Field>
          <Field label="税込金額"><input type="number" value={co.amount} onChange={(e) => setCo({ ...co, amount: e.target.value })} /></Field>
        </div>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={co.deductible} onChange={(e) => setCo({ ...co, deductible: e.target.checked })} /> 支払から差引対象</label>
        <button style={{ marginTop: 8 }} onClick={addCase} disabled={!co.name}>追加</button>
      </div>

      <div className="card">
        <h3>原価オプション <Internal>顧客・契約書・メール非表示</Internal></h3>
        <table><thead><tr><th>名称</th><th>数量</th><th className="num">税込金額</th><th></th></tr></thead>
          <tbody>{c.costOptions.map((o: any) => (
            <tr key={o.id}><td>{o.name}</td><td>{o.quantity}</td><td className="num">{yen(o.amount)}</td>
              <td><button className="btn-danger btn-sm" onClick={async () => { await api.del(`/api/options/cost-options/${o.id}`); reload(); }}>削除</button></td></tr>))}
          </tbody></table>
        <div className="grid2" style={{ marginTop: 10 }}>
          <Field label="名称"><input value={ro.name} onChange={(e) => setRo({ ...ro, name: e.target.value })} placeholder="外注費 等" /></Field>
          <Field label="税込金額"><input type="number" value={ro.amount} onChange={(e) => setRo({ ...ro, amount: e.target.value })} /></Field>
        </div>
        <button style={{ marginTop: 8 }} onClick={addCost} disabled={!ro.name}>追加</button>
      </div>
    </div>
  );
}

// ---------------- 本人確認 ----------------
function IdentityTab({ c, reload }: any) {
  const [f, setF] = useState<any>({ method: c.purchaseMethod === 'DELIVERY' ? 'NONFACE_ID_IMAGE_PLUS' : 'FACE_TO_FACE', documentType: 'DRIVERS_LICENSE', imageUrl: '' });
  const submit = async () => {
    await api.post('/api/identity', { ...f, caseId: c.id });
    setF({ ...f, imageUrl: '' });
    reload();
  };
  const methods = c.purchaseMethod === 'DELIVERY'
    ? ['NONFACE_REGISTERED_MAIL', 'NONFACE_ID_IMAGE_PLUS', 'NONFACE_IC_CHIP', 'NONFACE_E_SIGNATURE']
    : Object.keys(VERIFICATION_METHOD_LABEL);

  return (
    <div className="card">
      <h3>本人確認（古物営業法準拠）</h3>
      {c.purchaseMethod === 'DELIVERY' && <p className="badge amber">宅配（非対面）取引：身分証画像のアップロードのみでは確認完了になりません。施行規則の方法を選択してください。</p>}
      <table><thead><tr><th>確認方法</th><th>身分証種別</th><th>確認日時</th><th>画像</th></tr></thead>
        <tbody>{c.identity.map((iv: any) => (
          <tr key={iv.id}><td>{VERIFICATION_METHOD_LABEL[iv.method]}</td><td>{ID_DOCUMENT_LABEL[iv.documentType]}</td><td>{datetime(iv.verifiedAt)}</td><td>{iv.imageUrl ? '登録済' : '-'}</td></tr>))}
          {c.identity.length === 0 && <tr><td colSpan={4} className="muted">未登録</td></tr>}
        </tbody></table>
      <div className="divider" />
      <div className="grid3">
        <Field label="確認方法"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{VERIFICATION_METHOD_LABEL[m]}</option>)}</select></Field>
        <Field label="身分証種別"><select value={f.documentType} onChange={(e) => setF({ ...f, documentType: e.target.value })}>{Object.entries(ID_DOCUMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="身分証画像"><input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, imageUrl: await toDataUrl(file) }); }} /></Field>
      </div>
      <button onClick={submit}>本人確認を登録</button>
    </div>
  );
}

// ---------------- 契約書 ----------------
function ContractsTab({ c, navigate }: any) {
  return (
    <div className="card">
      <h3>契約書</h3>
      <table><thead><tr><th>作成日</th><th>ステータス</th><th>署名</th><th>URL</th><th></th></tr></thead>
        <tbody>{c.contracts.map((ct: any) => (
          <tr key={ct.id}><td>{datetime(ct.createdAt)}</td><td>{ct.status}</td><td>{ct.signature ? '署名済' : '-'}</td>
            <td><a href={`/sign/${ct.token}`} target="_blank" rel="noreferrer">顧客リンク</a></td>
            <td><a href={`${api.baseUrl}/api/public/contracts/${ct.token}/pdf`} target="_blank" rel="noreferrer">PDF</a></td></tr>))}
          {c.contracts.length === 0 && <tr><td colSpan={5} className="muted">未作成</td></tr>}
        </tbody></table>
      <button style={{ marginTop: 10 }} onClick={() => navigate(`/cases/${c.id}/contract`)}>契約書を作成</button>
    </div>
  );
}

// ---------------- 領収書 ----------------
function ReceiptsTab({ c, reload }: any) {
  const [f, setF] = useState<any>({ recipientName: c.customer.name, amount: c.totals.customerPayable > 0 ? c.totals.customerPayable : 0, description: '買取代金として', paymentMethod: 'CASH', registrationNumber: '' });
  const issue = async () => {
    const r = await api.post<any>('/api/receipts', { ...f, caseId: c.id, amount: Number(f.amount) });
    alert(`領収書 ${r.receiptNumber} を発行しました`);
    reload();
  };
  return (
    <div className="card">
      <h3>電子領収書</h3>
      <table><thead><tr><th>領収書番号</th><th>発行日</th><th>宛名</th><th className="num">金額</th><th>方法</th><th>状態</th><th>PDF</th></tr></thead>
        <tbody>{c.receipts.map((r: any) => (
          <tr key={r.id}><td>{r.receiptNumber}</td><td>{date(r.issuedAt)}</td><td>{r.recipientName}</td><td className="num">{yen(r.amount)}</td><td>{r.paymentMethod}</td>
            <td>{r.status === 'ISSUED' ? '発行済' : r.status === 'CANCELLED' ? '取消' : '再発行(旧)'}</td>
            <td><a href={`${api.baseUrl}/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer">PDF</a></td></tr>))}
          {c.receipts.length === 0 && <tr><td colSpan={7} className="muted">未発行</td></tr>}
        </tbody></table>
      <div className="divider" />
      <div className="grid4">
        <Field label="宛名"><input value={f.recipientName} onChange={(e) => setF({ ...f, recipientName: e.target.value })} /></Field>
        <Field label="金額（税込）"><input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="但し書き"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="支払方法"><select value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value })}><option value="CASH">現金</option><option value="BANK_TRANSFER">振込</option><option value="OFFSET">差引精算</option></select></Field>
        <Field label="登録番号(インボイス)"><input value={f.registrationNumber} onChange={(e) => setF({ ...f, registrationNumber: e.target.value })} placeholder="T1234567890123" /></Field>
      </div>
      <button onClick={issue} disabled={!f.amount}>領収書を発行</button>
    </div>
  );
}

// ---------------- 入出金・精算 ----------------
function PaymentsTab({ c, reload }: any) {
  const [p, setP] = useState<any>({ direction: 'WITHDRAWAL', amount: 0, scheduledDate: '', bankName: '', branchName: '', accountType: 'ORDINARY', accountNumber: '', accountHolder: '', status: 'SCHEDULED' });
  const [s, setS] = useState<any>(c.settlement || { cashReceived: 0, cashPaid: 0, customerPayment: 0, customerReceipt: 0 });
  const addPay = async () => { await api.post('/api/payments', { ...p, caseId: c.id, amount: Number(p.amount) }); reload(); };
  const saveSettle = async () => { await api.put(`/api/payments/settlement/${c.id}`, { cashReceived: Number(s.cashReceived), cashPaid: Number(s.cashPaid), customerPayment: Number(s.customerPayment), customerReceipt: Number(s.customerReceipt) }); reload(); };

  return (
    <div>
      <div className="card">
        <h3>現金精算</h3>
        <div className="grid4">
          <Field label="現金受領（顧客→当社）"><input type="number" value={s.cashReceived} onChange={(e) => setS({ ...s, cashReceived: e.target.value })} /></Field>
          <Field label="現金支払（当社→顧客）"><input type="number" value={s.cashPaid} onChange={(e) => setS({ ...s, cashPaid: e.target.value })} /></Field>
          <Field label="顧客への支払額"><input type="number" value={s.customerPayment} onChange={(e) => setS({ ...s, customerPayment: e.target.value })} /></Field>
          <Field label="顧客からの受領額"><input type="number" value={s.customerReceipt} onChange={(e) => setS({ ...s, customerReceipt: e.target.value })} /></Field>
        </div>
        <button onClick={saveSettle}>精算を保存</button>
      </div>

      <div className="card">
        <h3>入出金登録（振込のみ）</h3>
        <table><thead><tr><th>区分</th><th className="num">金額</th><th>予定日</th><th>実行日</th><th>金融機関</th><th>状態</th></tr></thead>
          <tbody>{c.payments.map((pm: any) => (
            <tr key={pm.id}><td>{pm.direction === 'DEPOSIT' ? '入金' : '出金'}</td><td className="num">{yen(pm.amount)}</td><td>{date(pm.scheduledDate)}</td><td>{date(pm.executedDate)}</td><td>{pm.bankName} {pm.branchName}</td><td>{({SCHEDULED:'予定',COMPLETED:'完了',CANCELLED:'取消'} as any)[pm.status]}</td></tr>))}
            {c.payments.length === 0 && <tr><td colSpan={6} className="muted">なし</td></tr>}
          </tbody></table>
        <div className="divider" />
        <div className="grid4">
          <Field label="区分"><select value={p.direction} onChange={(e) => setP({ ...p, direction: e.target.value })}><option value="DEPOSIT">入金（顧客→当社）</option><option value="WITHDRAWAL">出金（当社→顧客）</option></select></Field>
          <Field label="金額"><input type="number" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} /></Field>
          <Field label="予定日"><input type="date" value={p.scheduledDate} onChange={(e) => setP({ ...p, scheduledDate: e.target.value })} /></Field>
          <Field label="金融機関名"><input value={p.bankName} onChange={(e) => setP({ ...p, bankName: e.target.value })} /></Field>
          <Field label="支店名"><input value={p.branchName} onChange={(e) => setP({ ...p, branchName: e.target.value })} /></Field>
          <Field label="口座種別"><select value={p.accountType} onChange={(e) => setP({ ...p, accountType: e.target.value })}><option value="ORDINARY">普通</option><option value="CURRENT">当座</option><option value="SAVINGS">貯蓄</option></select></Field>
          <Field label="口座番号"><input value={p.accountNumber} onChange={(e) => setP({ ...p, accountNumber: e.target.value })} /></Field>
          <Field label="口座名義"><input value={p.accountHolder} onChange={(e) => setP({ ...p, accountHolder: e.target.value })} /></Field>
        </div>
        <button onClick={addPay} disabled={!p.amount}>入出金を登録</button>
      </div>
    </div>
  );
}

// ---------------- helpers ----------------
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}
function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await toDataUrl(file) : null);
    };
    input.click();
  });
}
