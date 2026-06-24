import { prisma } from '../lib/prisma';
import { createEvent, updateEvent, deleteEvent, endFromHours } from './calendar';
import { env } from '../config/env';

/**
 * 査定日・作業日の登録/変更に応じて担当者ごとの Google カレンダー予定を同期する。
 * - 査定担当者と作業担当者が別なら別カレンダーへ別予定を登録
 * - ステータスが CANCELLED になったら予定を削除
 * - 顧客には招待を送らない（calendar.ts 側で attendees を付与しない）
 */
export async function syncCaseCalendar(caseId: string): Promise<void> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { customer: true, appraiser: true, worker: true },
  });
  if (!c) return;

  const addr = [c.customer.prefecture, c.customer.city, c.customer.address, c.customer.building]
    .filter(Boolean)
    .join(' ');
  const caseUrl = `${env.appPublicUrl}/cases/${c.id}`;

  const buildDescription = (kind: '査定' | '作業') =>
    [
      `案件: ${c.caseNumber}`,
      `顧客: ${c.customer.name}`,
      `電話: ${c.customer.phone}`,
      `住所: ${addr}`,
      `種別: ${kind}`,
      `担当: ${kind === '査定' ? c.appraiser?.name ?? '-' : c.worker?.name ?? '-'}`,
      `案件URL: ${caseUrl}`,
      c.internalMemo ? `社内メモ: ${c.internalMemo}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  const cancelled = c.status === 'CANCELLED';

  // ---- 査定予定 ----
  if (c.appraiser?.calendarId && c.appraisalAt && !cancelled) {
    const start = c.appraisalAt;
    const end = endFromHours(start, c.appraisalHours);
    const input = {
      calendarId: c.appraiser.calendarId,
      summary: `【査定】${c.caseNumber} ${c.customer.name}`,
      description: buildDescription('査定'),
      location: addr,
      start,
      end,
    };
    const id = c.appraisalEventId
      ? await updateEvent(c.appraisalEventId, input)
      : await createEvent(input);
    if (id && id !== c.appraisalEventId) {
      await prisma.case.update({ where: { id: c.id }, data: { appraisalEventId: id } });
    }
  } else if (c.appraisalEventId && (cancelled || !c.appraisalAt) && c.appraiser?.calendarId) {
    await deleteEvent(c.appraiser.calendarId, c.appraisalEventId);
    await prisma.case.update({ where: { id: c.id }, data: { appraisalEventId: null } });
  }

  // ---- 作業予定 ----
  if (c.worker?.calendarId && c.workAt && !cancelled) {
    const start = c.workAt;
    const end = endFromHours(start, c.workHours);
    const input = {
      calendarId: c.worker.calendarId,
      summary: `【作業】${c.caseNumber} ${c.customer.name}`,
      description: buildDescription('作業'),
      location: addr,
      start,
      end,
    };
    const id = c.workEventId
      ? await updateEvent(c.workEventId, input)
      : await createEvent(input);
    if (id && id !== c.workEventId) {
      await prisma.case.update({ where: { id: c.id }, data: { workEventId: id } });
    }
  } else if (c.workEventId && (cancelled || !c.workAt) && c.worker?.calendarId) {
    await deleteEvent(c.worker.calendarId, c.workEventId);
    await prisma.case.update({ where: { id: c.id }, data: { workEventId: null } });
  }
}
