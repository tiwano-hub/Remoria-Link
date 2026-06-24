import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 税率（初期 10%）
  const taxCount = await prisma.taxRate.count();
  if (taxCount === 0) {
    await prisma.taxRate.create({
      data: { rate: 0.1, label: '標準税率 10%', effectiveFrom: new Date('2019-10-01'), isDefault: true },
    });
  }

  // 店舗（在庫番号プレフィックス）
  const store = await prisma.store.upsert({
    where: { code: 'KOBE' },
    create: { code: 'KOBE', name: '神戸店' },
    update: {},
  });

  // 販路
  for (const name of ['ヤフオク', 'メルカリ', '店頭', '業者市場', 'eBay']) {
    await prisma.salesChannel.upsert({ where: { name }, create: { name }, update: {} });
  }
  // 反響経路
  for (const name of ['Web検索', 'チラシ', '紹介', 'リピート', 'SNS', '電話帳']) {
    await prisma.referralSource.upsert({ where: { name }, create: { name }, update: {} });
  }
  // 保管場所
  for (const name of ['本店倉庫', '第2倉庫', '店頭']) {
    await prisma.storageLocation.upsert({ where: { name }, create: { name }, update: {} });
  }

  // 管理者ユーザー（開発用ログインで使用）
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    create: { email: 'admin@example.com', name: '管理者', role: 'ADMIN', storeId: store.id },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: 'appraiser@example.com' },
    create: { email: 'appraiser@example.com', name: '査定 太郎', role: 'APPRAISER', storeId: store.id },
    update: {},
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
