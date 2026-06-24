import { google } from 'googleapis';
import { env } from '../config/env';

/**
 * Google カレンダー連携。
 * GOOGLE_CALENDAR_CREDENTIALS（サービスアカウント JSON）が無い場合は no-op。
 * 顧客にはカレンダー招待を送らない（attendees を付与しない）。
 */

function getClient() {
  if (!env.googleCalendarCredentials) return null;
  try {
    const creds = JSON.parse(env.googleCalendarCredentials);
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });
    return google.calendar({ version: 'v3', auth });
  } catch (e) {
    console.error('[calendar] invalid credentials', e);
    return null;
  }
}

export interface CalendarEventInput {
  calendarId: string; // 担当者のカレンダーID
  summary: string; // 案件名＋種別
  description: string;
  location?: string;
  start: Date;
  end: Date;
}

/** 予定を作成し eventId を返す。連携無効時は null。 */
export async function createEvent(input: CalendarEventInput): Promise<string | null> {
  const cal = getClient();
  if (!cal) return null;
  try {
    const res = await cal.events.insert({
      calendarId: input.calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: input.start.toISOString(), timeZone: 'Asia/Tokyo' },
        end: { dateTime: input.end.toISOString(), timeZone: 'Asia/Tokyo' },
        // 顧客にカレンダー招待を送らないため attendees は付与しない
      },
    });
    return res.data.id ?? null;
  } catch (e) {
    console.error('[calendar] createEvent failed', e);
    return null;
  }
}

export async function updateEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<string | null> {
  const cal = getClient();
  if (!cal) return null;
  try {
    const res = await cal.events.update({
      calendarId: input.calendarId,
      eventId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: input.start.toISOString(), timeZone: 'Asia/Tokyo' },
        end: { dateTime: input.end.toISOString(), timeZone: 'Asia/Tokyo' },
      },
    });
    return res.data.id ?? null;
  } catch (e) {
    console.error('[calendar] updateEvent failed', e);
    return null;
  }
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const cal = getClient();
  if (!cal) return;
  try {
    await cal.events.delete({ calendarId, eventId });
  } catch (e) {
    console.error('[calendar] deleteEvent failed', e);
  }
}

/** 開始時刻と時間幅（0.5刻み）から終了時刻を算出 */
export function endFromHours(start: Date, hours: number | null | undefined): Date {
  const h = hours && hours > 0 ? hours : 1;
  return new Date(start.getTime() + h * 60 * 60 * 1000);
}
