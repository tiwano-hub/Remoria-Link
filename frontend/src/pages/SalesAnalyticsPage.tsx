import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Kpi, Field } from '../components/ui';
import { yen, pct } from '../lib/format';

const GROUP_BY_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: '全体' },
  { value: 'appraiser', label: '買取担当者別' },
  { value: 'booker', label: '予約担当者別' },
  { value: 'customerType', label: '顧客種別' },
  { value: 'referralSource', label: '反響経路' },
  { value: 'appointmentRank', label: 'アポランク' },
  { value: 'channel', label: '販路' },
  { value: 'grade', label: '商品グレード' },
  { value: 'inventoryStatus', label: '在庫ステータス' },
  { value: 'date', label: '日付' },
];

const CSV_HEADERS = [
  '区分', '件数', '実売上', '買取金額', '案件オプション', '原価オプション', '実粗利', '実粗利(入金)', '原価率(%)',
];

export default function SalesAnalyticsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ from: '', to: '', groupBy: 'none', taxMode: 'included', dateBase: 'sold' });

  useEffect(() => {
    const qs = new URLSearchParams();
    if (f.from) qs.set('from', f.from);
    if (f.to) qs.set('to', f.to);
    qs.set('groupBy', f.groupBy);
    qs.set('taxMode', f.taxMode);
    qs.set('dateBase', f.dateBase);
    api.get<any>(`/api/analytics/sales?${qs.toString()}`).then((r) => setRows(r.rows || [])).catch(() => {});
  }, [f.from, f.to, f.groupBy, f.taxMode, f.dateBase]);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const sum = (key: string) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const exportCsv = () => {
    const lines = [CSV_HEADERS.join(',')];
    rows.forEach((r) => {
      lines.push([
        r.key, r.count, r.realRevenue, r.purchaseTotal, r.caseOptionTotal, r.costOptionTotal,
        r.realGrossProfit, r.paidGrossProfit, r.costRate,
      ].join(','));
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '販売分析.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>販売分析</h2>
        <button className="btn-sub" onClick={exportCsv}>CSV出力</button>
      </div>

      <div className="grid3">
        <Kpi label="実粗利" value={yen(sum('realGrossProfit'))} />
        <Kpi label="実売上" value={yen(sum('realRevenue'))} />
        <Kpi label="買取金額" value={yen(sum('purchaseTotal'))} />
        <Kpi label="販売件数" value={sum('count')} />
        <Kpi label="実粗利(入金ベース)" value={yen(sum('paidGrossProfit'))} />
      </div>

      <div className="card">
        <div className="toolbar">
          <Field label="期間（自）"><input type="date" value={f.from} onChange={set('from')} /></Field>
          <Field label="期間（至）"><input type="date" value={f.to} onChange={set('to')} /></Field>
          <Field label="集計軸">
            <select value={f.groupBy} onChange={set('groupBy')}>
              {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="基準日">
            <div className="pill-tabs">
              <button className={f.dateBase === 'sold' ? 'active' : ''} onClick={() => setF({ ...f, dateBase: 'sold' })}>販売日</button>
              <button className={f.dateBase === 'paid' ? 'active' : ''} onClick={() => setF({ ...f, dateBase: 'paid' })}>入金日</button>
              <button className={f.dateBase === 'contract' ? 'active' : ''} onClick={() => setF({ ...f, dateBase: 'contract' })}>契約日</button>
            </div>
          </Field>
          <Field label="税区分">
            <div className="pill-tabs">
              <button className={f.taxMode === 'included' ? 'active' : ''} onClick={() => setF({ ...f, taxMode: 'included' })}>税込</button>
              <button className={f.taxMode === 'excluded' ? 'active' : ''} onClick={() => setF({ ...f, taxMode: 'excluded' })}>税抜</button>
            </div>
          </Field>
        </div>

        <table>
          <thead>
            <tr>
              <th>区分</th><th className="num">件数</th><th className="num">実売上</th><th className="num">買取金額</th>
              <th className="num">案件オプション</th><th className="num">原価オプション</th>
              <th className="num">実粗利</th><th className="num">実粗利(入金)</th><th className="num">原価率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key ?? i}>
                <td>{r.key}</td>
                <td className="num">{r.count}</td>
                <td className="num">{yen(r.realRevenue)}</td>
                <td className="num">{yen(r.purchaseTotal)}</td>
                <td className="num">{yen(r.caseOptionTotal)}</td>
                <td className="num">{yen(r.costOptionTotal)}</td>
                <td className="num">{yen(r.realGrossProfit)}</td>
                <td className="num">{yen(r.paidGrossProfit)}</td>
                <td className="num">{pct(r.costRate)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="muted">データがありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
