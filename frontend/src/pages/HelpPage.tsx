import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

type Msg = { role: 'user' | 'assistant'; content: string };

const EXPORTS = [
  { type: 'cases', label: '案件' },
  { type: 'customers', label: '顧客' },
  { type: 'inventory', label: '在庫' },
  { type: 'sales', label: '販売' },
  { type: 'payments', label: '入出金' },
  { type: 'receipts', label: '領収書' },
  { type: 'users', label: 'ユーザー' },
  { type: 'audit-logs', label: '操作ログ' },
];

export default function HelpPage() {
  const [tab, setTab] = useState<'manual' | 'chat' | 'export'>('manual');
  return (
    <div>
      <h2>使い方・AIサポート</h2>
      <div className="pill-tabs">
        <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>マニュアル</button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>AIチャット</button>
        <button className={tab === 'export' ? 'active' : ''} onClick={() => setTab('export')}>データ出力</button>
      </div>
      {tab === 'manual' && <ManualTab />}
      {tab === 'chat' && <ChatTab />}
      {tab === 'export' && <ExportTab />}
    </div>
  );
}

function ManualTab() {
  const [md, setMd] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.get<{ markdown: string }>('/api/assistant/manual').then((r) => setMd(r.markdown)).catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="error">{error}</div>;
  if (!md) return <div className="muted">読み込み中...</div>;
  return <div className="card"><Markdown text={md} /></div>;
}

function ChatTab() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError('');
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const r = await api.post<{ reply: string }>('/api/assistant/chat', { messages: next });
      setMessages([...next, { role: 'assistant', content: r.reply }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <p className="muted">操作方法や仕様について日本語で質問できます（回答はマニュアルに基づきます）。</p>
      <div style={{ minHeight: 200, maxHeight: 420, overflowY: 'auto', margin: '10px 0' }}>
        {messages.length === 0 && (
          <p className="muted">例：「案件を登録するには？」「CSVはどこから出力できますか？」</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0', textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <div
              style={{
                display: 'inline-block', textAlign: 'left', maxWidth: '90%',
                padding: '8px 12px', borderRadius: 12,
                background: m.role === 'user' ? 'rgba(37,229,138,0.16)' : 'rgba(255,255,255,0.06)',
                border: '1px solid var(--line)', whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="muted">回答を生成中…</p>}
        <div ref={endRef} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <input
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="質問を入力してEnter"
          disabled={busy}
        />
        <button onClick={send} disabled={busy || !input.trim()}>送信</button>
      </div>
    </div>
  );
}

function ExportTab() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const run = async (type: string, label: string) => {
    setError('');
    setLoading(type);
    try {
      await api.download(`/api/export/${type}.csv`, `${type}.csv`);
    } catch (e: any) {
      setError(`${label}の出力に失敗しました：${e.message}`);
    } finally {
      setLoading('');
    }
  };
  return (
    <div className="card">
      <h3>データ出力（CSV）</h3>
      <p className="muted">各データをCSVで書き出します。Excelでそのまま開けます（UTF-8・文字化け対策済み）。</p>
      {error && <div className="error">{error}</div>}
      <div className="grid3" style={{ marginTop: 10 }}>
        {EXPORTS.map((e) => (
          <button key={e.type} className="btn-sub" onClick={() => run(e.type, e.label)} disabled={!!loading}>
            {loading === e.type ? '出力中…' : `${e.label} CSV`}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- 軽量Markdownレンダラ（見出し/箇条書き/表/太字/段落） ---
function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: JSX.Element[] = [];
  let i = 0;
  let key = 0;
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, idx) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={idx}>{part.slice(2, -2)}</strong>
        : <span key={idx}>{part}</span>,
    );

  while (i < lines.length) {
    const line = lines[i];
    if (/^### /.test(line)) { out.push(<h4 key={key++} style={{ margin: '14px 0 6px' }}>{inline(line.slice(4))}</h4>); i++; continue; }
    if (/^## /.test(line)) { out.push(<h3 key={key++} style={{ margin: '18px 0 8px' }}>{inline(line.slice(3))}</h3>); i++; continue; }
    if (/^# /.test(line)) { out.push(<h2 key={key++}>{inline(line.slice(2))}</h2>); i++; continue; }
    if (/^> /.test(line)) { out.push(<p key={key++} className="muted" style={{ borderLeft: '3px solid var(--line)', paddingLeft: 10 }}>{inline(line.slice(2))}</p>); i++; continue; }
    if (/^---\s*$/.test(line)) { out.push(<div key={key++} className="divider" />); i++; continue; }
    // table
    if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1])) {
      const header = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push(
        <table key={key++} style={{ margin: '8px 0' }}>
          <thead><tr>{header.map((h, hi) => <th key={hi}>{inline(h)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    // bullet list
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(lines[i].replace(/^[-*] /, '')); i++; }
      out.push(<ul key={key++} style={{ margin: '6px 0', paddingLeft: 20 }}>{items.map((it, ii) => <li key={ii}>{inline(it)}</li>)}</ul>);
      continue;
    }
    // ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
      out.push(<ol key={key++} style={{ margin: '6px 0', paddingLeft: 20 }}>{items.map((it, ii) => <li key={ii}>{inline(it)}</li>)}</ol>);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    out.push(<p key={key++} style={{ margin: '6px 0' }}>{inline(line)}</p>);
    i++;
  }
  return <div>{out}</div>;
}
