import nodemailer from 'nodemailer';
import { env } from '../config/env';

export function emailConfigured(): boolean {
  return !!(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFrom);
}
export function smsConfigured(): boolean {
  return !!(env.twilioSid && env.twilioToken && env.twilioFrom);
}

/** メール送信（SMTP） */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!to) throw new Error('宛先メールアドレスがありません');
  if (!emailConfigured()) {
    throw new Error('メール送信が未設定です。管理者に SMTP 設定（SMTP_HOST等）を依頼してください。');
  }
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
  await transport.sendMail({ from: env.mailFrom, to, subject, text });
}

/** 日本の番号を E.164（+81…）に整形 */
function toE164(phone: string): string {
  const d = phone.replace(/[^0-9+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('0')) return '+81' + d.slice(1);
  return d;
}

/** SMS送信（Twilio REST API） */
export async function sendSms(to: string, body: string): Promise<void> {
  if (!to) throw new Error('宛先電話番号がありません');
  if (!smsConfigured()) {
    throw new Error('SMS送信が未設定です。管理者に Twilio 設定（TWILIO_ACCOUNT_SID等）を依頼してください。');
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`;
  const auth = Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString('base64');
  const params = new URLSearchParams({ To: toE164(to), From: env.twilioFrom, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`SMS送信に失敗しました（${res.status}）: ${t.slice(0, 200)}`);
  }
}
