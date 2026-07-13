import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCalendarCredentials: process.env.GOOGLE_CALENDAR_CREDENTIALS || '',
  appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:5173',
  // 本番で簡易ログイン（メールのみ）を許可するか。Google認証設定前の初期アクセス用。
  allowSimpleLogin: process.env.ALLOW_SIMPLE_LOGIN === 'true',
  // 一時的にログインを停止する（メンテナンス等）。true の間は全ログインを拒否。
  loginDisabled: process.env.LOGIN_DISABLED === 'true',
  // メール送信（SMTP）
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || '',
  // SMS送信（Twilio）
  twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFrom: process.env.TWILIO_FROM || '',
};

export const isProd = env.nodeEnv === 'production';
