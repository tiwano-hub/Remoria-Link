import { AuditAction } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { Request } from 'express';

interface AuditInput {
  action: AuditAction;
  description?: string;
  beforeData?: unknown;
  afterData?: unknown;
  caseNumber?: string | null;
  entity?: string;
  entityId?: string;
}

function clientIp(req?: Request): string | undefined {
  if (!req) return undefined;
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress ?? undefined;
}

/**
 * 操作ログを記録する。法令対応・不正防止のため重要操作で必ず呼ぶ。
 * 記録失敗が業務処理を止めないよう、例外は握りつぶしてログ出力のみ行う。
 */
export async function audit(req: Request | undefined, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req?.user?.id,
        action: input.action,
        description: input.description,
        beforeData: input.beforeData === undefined ? undefined : (input.beforeData as any),
        afterData: input.afterData === undefined ? undefined : (input.afterData as any),
        ipAddress: clientIp(req),
        caseNumber: input.caseNumber ?? undefined,
        entity: input.entity,
        entityId: input.entityId,
      },
    });
  } catch (e) {
    console.error('[audit] failed to write audit log', e);
  }
}
