import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  storeId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signSession(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: '7d' });
}

/** Authorization: Bearer <jwt> または cookie からセッションを読む */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : (req.cookies?.session as string | undefined);
  if (!token) return res.status(401).json({ error: '認証が必要です' });
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'セッションが無効です' });
  }
}

/** 指定ロールのみ許可 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: '認証が必要です' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'この操作の権限がありません' });
    }
    next();
  };
}

/** 閲覧専用ユーザーは書き込み不可 */
export function denyViewer(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'VIEWER') {
    return res.status(403).json({ error: '閲覧専用ユーザーは編集できません' });
  }
  next();
}
