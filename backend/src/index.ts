import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';

import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import caseRoutes from './routes/cases';
import itemRoutes from './routes/items';
import optionRoutes from './routes/options';
import contractRoutes from './routes/contracts';
import identityRoutes from './routes/identity';
import receiptRoutes from './routes/receipts';
import paymentRoutes from './routes/payments';
import inventoryRoutes from './routes/inventory';
import salesRoutes from './routes/sales';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/users';
import masterRoutes from './routes/masters';
import auditRoutes from './routes/audit';
import publicRoutes from './routes/public';
import exportRoutes from './routes/export';
import assistantRoutes from './routes/assistant';

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin.split(','),
    credentials: true,
  }),
);
app.use(express.json({ limit: '15mb' })); // 画像 dataURL を許容
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'remoria-link', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/options', optionRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/assistant', assistantRoutes);

// エラーハンドラ
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'サーバエラー' });
});

app.listen(env.port, () => {
  console.log(`Remoria Link API listening on :${env.port} (${env.nodeEnv})`);
});
