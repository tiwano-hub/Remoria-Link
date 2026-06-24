import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Kpi, Field } from '../components/ui';
import { yen, pct } from '../lib/format';

const GROUP_BY_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: '全体' },
  { value: 'appraiser', label: '査定担当者別' },
  { value: 'booker', label: '予約担当者別' },
  { value: 'customerType', label: '顧客種別' },
  { value: 'referralSource', label: '反響経路' },
  { value: 'appointmentRank', label: 'アポランク' },
  { value: 'date', label: '日付' },
];

const CSV_HEADERS = [
  '区分', '問合数', '査定数', '成約数', '成約率(%)', 'リピーター率(%)',
  '買取金額', '見込金額', '案件オプション', '原価オプション', '見込粗利', '見込原価率(%)', '仕入点数', '平均仕入点数',
];

export default function PurchaseAnalyticsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ from: '', to: '', groupBy: 'none', taxMode: 'included' });

  useEffect(() => {
    const qs = new URLSearchParams();
    if (f.from) qs.set('from', f.from);
    if (f.to) qs.set('to', f.to);
    qs.set('groupBy', f.groupBy);
    qs.set('taxMode', f.taxMode);
    api.get<any>(`/api/analytics/purchase?${qs.toString()}`).then((r) => setRows(r.rows || [])).catch(() => {});
  }, [f.from, f.to, f.groupBy, f.taxMode]);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const sum = (key: string) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  const exportCsv = () => {
    const lines = [CSV_HEADERS.join(',')];
    rows.forEach((r) => {
      lines.push([
        r.key, r.inquiries, r.appraisals, r.closings, r.closingRate, r.repeaterRate,
        r.purchaseTotal, r.expectedTotal, r.caseOptionTotal, r.costOptionTotal,
        r.expectedGrossProfit, r.expectedCostRate, r.items, r.avgItems,
      ].join(','));
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '買取分析.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>買取分析</h2>
        <button className="btn-sub" onClick={exportCsv}>CSV出力</button>
      </div>

      <div className="grid3">
        <Kpi label="見込粗利" value={yen(sum('expectedGrossProfit'))} />
        <Kpi label="見込金額" value={yen(sum('expectedTotal'))} />
        <Kpi label="買取金額" value={yen(sum('purchaseTotal'))} />
        <Kpi label="問合数" value={sum('inquiries')} />
        <Kpi label="成約数" value={sum('closings')} />
        <Kpi label="仕入点数" value={sum('items')} />
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
              <th>区分</th><th className="num">問合数</th><th className="num">査定数</th><th className="num">成約数</th>
              <th className="num">成約率</th><th className="num">リピーター率</th>
              <th className="num">買取金額</th><th className="num">見込金額</th>
              <th className="num">案件オプション</th><th className="num">原価オプション</th>
              <th className="num">見込粗利</th><th className="num">見込原価率</th>
              <th className="num">仕入点数</th><th className="num">平均仕入点数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key ?? i}>
                <td><a style={{ cursor: 'pointer' }} onClick={() => navigate('/cases')}>{r.key}</a></td>
                <td className="num">{r.inquiries}</td>
                <td className="num">{r.appraisals}</td>
                <td className="num"><a style={{ cursor: 'pointer' }} onClick={() => navigate('/cases')}>{r.closings}</a></td>
                <td className="num">{pct(r.closingRate)}</td>
                <td className="num">{pct(r.repeaterRate)}</td>
                <td className="num">{yen(r.purchaseTotal)}</td>
                <td className="num">{yen(r.expectedTotal)}</td>
                <td className="num">{yen(r.caseOptionTotal)}</td>
                <td className="num">{yen(r.costOptionTotal)}</td>
                <td className="num">{yen(r.expectedGrossProfit)}</td>
                <td className="num">{pct(r.expectedCostRate)}</td>
                <td className="num">{r.items}</td>
                <td className="num">{r.avgItems}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={14} className="muted">データがありません</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
