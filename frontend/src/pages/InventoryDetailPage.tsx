import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Field, InventoryBadge } from '../components/ui';
import { yen, date } from '../lib/format';
import { INVENTORY_STATUS_LABEL } from '../types';

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}

export default function InventoryDetailPage() {
  const { id } = useParams();
  const [inv, setInv] = useState<any>(null);
  const [error, setError] = useState('');
  const [sale, setSale] = useState<any>({
    soldDate: '', paidDate: '', salesAmount: 0, fee: 0, shipping: 0,
    otherCost: 0, buyer: '', note: '',
  });
  const [saleError, setSaleError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get<any>(`/api/inventory/${id}`).then(setInv).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <div className="error">{error}</div>;
  if (!inv) return <div className="muted">読み込み中...</div>;

  const changeStatus = async (status: string) => {
    await api.put(`/api/inventory/${id}`, { status });
    load();
  };

  const addPhoto = async (file: File) => {
    const url = await toDataUrl(file);
    await api.post(`/api/inventory/${id}/photos`, { url });
    load();
  };

  const setS = (k: string) => (e: any) => setSale({ ...sale, [k]: e.target.value });

  const submitSale = async () => {
    setSaleError('');
    setSaving(true);
    try {
      await api.post('/api/sales', {
        inventoryId: id,
        soldDate: sale.soldDate,
        paidDate: sale.paidDate || undefined,
        salesAmount: Number(sale.salesAmount),
        fee: Number(sale.fee),
        shipping: Number(sale.shipping),
        otherCost: Number(sale.otherCost),
        salesChannel: inv.salesChannel,
        buyer: sale.buyer || undefined,
        note: sale.note || undefined,
      });
      setSale({ soldDate: '', paidDate: '', salesAmount: 0, fee: 0, shipping: 0, otherCost: 0, buyer: '', note: '' });
      load();
    } catch (e: any) {
      setSaleError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>{inv.inventoryNumber}　<InventoryBadge status={inv.status} /></h2>

      <div className="grid2">
        <div className="card">
          <h3>在庫情報（金額はすべて税込）</h3>
          <div className="grid2">
            <Field label="商品名"><div>{inv.name}</div></Field>
            <Field label="数量"><div>{inv.quantity}</div></Field>
            <Field label="グレード"><div>{inv.grade === 'NONE' ? 'なし' : inv.grade}</div></Field>
            <Field label="販路"><div>{inv.salesChannel || '-'}</div></Field>
            <Field label="買取金額"><div className="num">{yen(inv.purchaseAmount)}</div></Field>
            <Field label="見込金額（社内）"><div className="num">{yen(inv.expectedAmount)}</div></Field>
            <Field label="保管場所"><div>{inv.storageLocation || '-'}</div></Field>
            <Field label="仕入日"><div>{date(inv.stockedAt)}</div></Field>
          </div>
          <Field label="備考"><div>{inv.note || '-'}</div></Field>
          {inv.sourceCase && (
            <Field label="元案件">
              <div>
                <Link to={`/cases/${inv.sourceCase.id}`}>{inv.sourceCase.caseNumber}</Link>
                {inv.sourceCase.customer?.name ? `　（${inv.sourceCase.customer.name}）` : ''}
              </div>
            </Field>
          )}
        </div>

        <div className="card">
          <h3>ステータス変更</h3>
          <Field label="在庫ステータス">
            <select value={inv.status} onChange={(e) => changeStatus(e.target.value)}>
              {Object.entries(INVENTORY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>

          <div className="divider" />
          <h3>写真</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(inv.photos || []).map((p: any) => (
              <img key={p.id} src={p.url} alt="" style={{ maxWidth: 120, marginRight: 8, marginBottom: 8 }} />
            ))}
            {(!inv.photos || inv.photos.length === 0) && <span className="muted">写真なし</span>}
          </div>
          <Field label="写真を追加">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) addPhoto(file); }}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <h3>販売登録（金額はすべて税込）</h3>
        {saleError && <div className="error">{saleError}</div>}
        <div className="grid4">
          <Field label="販売日"><input type="date" value={sale.soldDate} onChange={setS('soldDate')} /></Field>
          <Field label="入金日"><input type="date" value={sale.paidDate} onChange={setS('paidDate')} /></Field>
          <Field label="販売金額（税込）"><input type="number" value={sale.salesAmount} onChange={setS('salesAmount')} /></Field>
          <Field label="販売手数料"><input type="number" value={sale.fee} onChange={setS('fee')} /></Field>
          <Field label="送料"><input type="number" value={sale.shipping} onChange={setS('shipping')} /></Field>
          <Field label="その他原価"><input type="number" value={sale.otherCost} onChange={setS('otherCost')} /></Field>
          <Field label="販売先"><input value={sale.buyer} onChange={setS('buyer')} /></Field>
          <Field label="備考"><input value={sale.note} onChange={setS('note')} /></Field>
        </div>
        <button onClick={submitSale} disabled={saving || !sale.soldDate || !sale.salesAmount}>
          {saving ? '登録中...' : '販売を登録'}
        </button>
      </div>

      {inv.sales && inv.sales.length > 0 && (
        <div className="card">
          <h3>販売履歴</h3>
          <table>
            <thead><tr><th>販売日</th><th className="num">販売金額</th></tr></thead>
            <tbody>
              {inv.sales.map((s: any) => (
                <tr key={s.id}><td>{date(s.soldDate)}</td><td className="num">{yen(s.salesAmount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
