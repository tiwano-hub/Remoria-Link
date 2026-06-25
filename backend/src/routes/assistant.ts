import { Router } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth';
import { buildManualMarkdown } from '../manual';

const router = Router();
router.use(authenticate);

/** GET /api/assistant/manual  使い方マニュアル（最新仕様を自動反映） */
router.get('/manual', (_req, res) => {
  res.json({ markdown: buildManualMarkdown() });
});

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(40),
});

/** POST /api/assistant/chat  マニュアルに基づくAIサポート（Claude） */
router.post('/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error:
        'AIサポートは未設定です。Render の remoria-link-api に環境変数 ANTHROPIC_API_KEY を設定してください。',
    });
  }
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const system = `あなたは「Remoria Link」（出張買取の業務管理システム）の使い方をサポートする日本語アシスタントです。
以下のマニュアルの内容に厳密に基づいて、簡潔で分かりやすく回答してください。
マニュアルに無い操作は推測で断定せず、「マニュアルに記載がありません」と伝えた上で一般的な案内に留めてください。
スマートフォンでの操作が前提です。

===== マニュアル =====
${buildManualMarkdown()}
===== ここまで =====`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system,
      messages: parsed.data.messages,
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    res.json({ reply: text || '（応答を生成できませんでした）' });
  } catch (e: any) {
    res.status(502).json({ error: e?.message || 'AIサポートでエラーが発生しました。' });
  }
});

export default router;
