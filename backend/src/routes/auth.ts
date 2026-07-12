import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { signSession, authenticate, AuthUser } from '../middleware/auth';
import { audit } from '../services/audit';

const router = Router();
const oauth = new OAuth2Client(env.googleClientId);

// 一時停止中は全ログインを拒否する
const blockIfLoginDisabled = (_req: any, res: any, next: any) => {
  if (env.loginDisabled) {
    return res.status(403).json({ error: 'ただいまシステムを一時停止しています。ログインはできません。' });
  }
  next();
};

/**
 * POST /api/auth/google
 * body: { credential } = Google Identity Services が返す ID トークン
 * 検証後、未登録メールは VIEWER として作成（初回のみ）。最初のユーザーは ADMIN。
 */
router.post('/google', blockIfLoginDisabled, async (req, res) => {
  const { credential } = req.body as { credential?: string };
  if (!credential) return res.status(400).json({ error: 'credential がありません' });
  try {
    const ticket = await oauth.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(401).json({ error: 'トークンが無効です' });

    let user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      // 初期セットアップ用：ユーザーが1人もいないときだけ、最初のログインを管理者として作成
      const count = await prisma.user.count();
      if (count === 0) {
        user = await prisma.user.create({
          data: { email: payload.email, name: payload.name || payload.email, googleId: payload.sub, role: 'ADMIN' },
        });
      } else {
        return res.status(403).json({ error: '登録されていないメールアドレスです。管理者にユーザー追加を依頼してください。' });
      }
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub },
      });
    }

    if (!user.active) return res.status(403).json({ error: 'アカウントが無効化されています' });

    const sessionUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      storeId: user.storeId,
    };
    const token = signSession(sessionUser);
    await audit(req, { action: 'LOGIN', description: `${user.email} ログイン` });
    res.json({ token, user: sessionUser });
  } catch (e) {
    console.error('[auth] google verify failed', e);
    res.status(401).json({ error: 'Google 認証に失敗しました' });
  }
});

/**
 * 開発用ログイン（GOOGLE_CLIENT_ID 未設定時のみ有効）。
 * 本番では無効。メールアドレスを指定して既存ユーザーとしてログイン。
 */
/**
 * 簡易ログイン（メールアドレスのみ）。
 * 開発環境では常に有効。本番環境では ALLOW_SIMPLE_LOGIN=true のときだけ有効。
 * ※本番で有効にするのは Google 認証設定前の初期アクセス用。運用開始後は
 *   ALLOW_SIMPLE_LOGIN を未設定（無効）にし、Google 認証へ切り替えてください。
 */
router.post('/dev-login', blockIfLoginDisabled, async (req, res) => {
  if (env.nodeEnv === 'production' && !env.allowSimpleLogin) {
    return res.status(403).json({ error: '簡易ログインは無効です（管理者にお問い合わせください）' });
  }
  const email = (req.body?.email as string | undefined)?.trim();
  if (!email) return res.status(400).json({ error: 'email が必要です' });
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // 初期セットアップ用：ユーザーが1人もいないときだけ、最初のログインを管理者として作成
    const count = await prisma.user.count();
    if (count === 0) {
      user = await prisma.user.create({ data: { email, name: email.split('@')[0], role: 'ADMIN' } });
    } else {
      return res.status(403).json({ error: '登録されていないメールアドレスです。管理者にユーザー追加を依頼してください。' });
    }
  }
  if (!user.active) return res.status(403).json({ error: 'このアカウントは無効化されています。' });
  const sessionUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    storeId: user.storeId,
  };
  res.json({ token: signSession(sessionUser), user: sessionUser });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { store: true },
  });
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    storeId: user.storeId,
    store: user.store,
    calendarId: user.calendarId,
  });
});

export default router;
