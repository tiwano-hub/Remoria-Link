// アプリ仕様の単一の出典（Single Source of Truth）。
// ここを直すと マニュアル・AIサポート・CSV出力 のラベルがすべて追従する。

export const CASE_STATUS_LABEL: Record<string, string> = {
  INQUIRY: '問合中',
  RESERVED: '予約中',
  APPRAISING: '査定中',
  APPROVED: '承認済',
  EXECUTED: '実施済',
  COMPLETED: '完了',
  CONSIDERING: '検討中',
  CANCELLED: '中止',
};

export const PURCHASE_METHOD_LABEL: Record<string, string> = {
  VISIT: '出張',
  DELIVERY: '宅配',
  STORE: '店頭',
  CONSIGNMENT: '委託',
};

// 遠隔（非対面）取引：身分証画像が必須
export const REMOTE_METHODS = ['DELIVERY', 'CONSIGNMENT'];
// 表裏の画像が必要な身分証
export const NEEDS_BACK_DOCS = ['DRIVERS_LICENSE', 'HEALTH_INSURANCE'];

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: '管理者',
  STORE_MANAGER: '店長',
  APPRAISER: '査定士',
  BOOKER: '予約担当',
  VIEWER: '閲覧のみ',
};

export const INVENTORY_STATUS_LABEL: Record<string, string> = {
  IN_STOCK: '在庫',
  LISTED: '出品中',
  SOLD: '売却済',
  DISPOSED: '廃棄',
  RETURNED: '返品',
  ON_HOLD: '保留',
};

export const PAYMENT_DIRECTION_LABEL: Record<string, string> = {
  DEPOSIT: '入金（顧客→当社）',
  WITHDRAWAL: '出金（当社→顧客）',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: '予定',
  COMPLETED: '完了',
  CANCELLED: '取消',
};

export const SALE_STATUS_LABEL: Record<string, string> = {
  COMPLETED: '完了',
  PENDING: '進行中',
  CANCELLED: '取消',
};

export const RECEIPT_STATUS_LABEL: Record<string, string> = {
  ISSUED: '発行済',
  CANCELLED: '取消',
  REISSUED: '再発行(旧)',
};

export const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  NEW: '新規',
  REPEATER: 'リピーター',
};

export const SETTLEMENT_METHOD_LABEL: Record<string, string> = {
  CASH: '現金',
  BANK_TRANSFER: '振込',
  OFFSET: '差引精算',
};

// 画面（メニュー）構成
export const NAV = [
  { group: '案件', items: [
    { label: '電話番号入力', desc: '電話番号から顧客を検索し、新規案件を作成します（既存顧客は自動でリピーター判定）。' },
    { label: '案件一覧', desc: '案件を検索・絞り込みし、各案件の詳細を開きます。' },
  ] },
  { group: '在庫・販売', items: [
    { label: '在庫一覧', desc: '買取品から登録した在庫を管理します。' },
    { label: '在庫登録', desc: '在庫を手動で登録します（案件からの自動登録も可能）。' },
    { label: '販売実績', desc: '在庫の販売を記録し、粗利を管理します。' },
  ] },
  { group: '入出金', items: [
    { label: '入出金管理', desc: '振込の予定・実行や現金精算を記録します。' },
    { label: '電子領収書', desc: 'インボイス対応の電子領収書を発行します。' },
  ] },
  { group: '分析', items: [
    { label: '買取分析', desc: '買取の件数・金額・担当者別などを集計します。' },
    { label: '販売分析', desc: '販売の売上・粗利・販路別などを集計します。' },
  ] },
  { group: '管理', items: [
    { label: 'ユーザー管理', desc: 'スタッフのアカウントと権限を管理します。' },
    { label: 'マスタ管理', desc: '販路・反響経路・保管場所などのマスタを管理します。' },
    { label: '操作ログ', desc: '誰がいつ何を変更したかの監査ログを確認します。' },
  ] },
  { group: 'ヘルプ', items: [
    { label: '使い方・AIサポート', desc: 'このマニュアルとAIチャット、CSV出力。' },
  ] },
];
