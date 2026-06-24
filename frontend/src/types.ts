export type Role = 'ADMIN' | 'STORE_MANAGER' | 'APPRAISER' | 'BOOKER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  storeId: string | null;
  calendarId?: string | null;
  store?: { name: string } | null;
}

export type CaseStatus =
  | 'INQUIRY' | 'RESERVED' | 'APPRAISING' | 'APPROVED'
  | 'EXECUTED' | 'COMPLETED' | 'CONSIDERING' | 'CANCELLED';

export type PurchaseMethod = 'VISIT' | 'DELIVERY' | 'STORE';
export type Grade = 'N' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'J' | 'NONE';
export type AppointmentRank = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  INQUIRY: '問合中', RESERVED: '予約中', APPRAISING: '査定中', APPROVED: '承認済',
  EXECUTED: '実施済', COMPLETED: '完了', CONSIDERING: '検討中', CANCELLED: '中止',
};

export const PURCHASE_METHOD_LABEL: Record<PurchaseMethod, string> = {
  VISIT: '出張', DELIVERY: '宅配', STORE: '店頭',
};

export const INVENTORY_STATUS_LABEL: Record<string, string> = {
  IN_STOCK: '在庫中', LISTED: '出品中', SOLD: '販売済',
  DISPOSED: '処分済', RETURNED: '返品', ON_HOLD: '保留',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '管理者', STORE_MANAGER: '店舗責任者', APPRAISER: '査定担当者',
  BOOKER: '予約担当者', VIEWER: '閲覧専用',
};

export const GRADES: Grade[] = ['N', 'S', 'A', 'B', 'C', 'D', 'E', 'J', 'NONE'];

export const VERIFICATION_METHOD_LABEL: Record<string, string> = {
  FACE_TO_FACE: '対面確認',
  NONFACE_REGISTERED_MAIL: '非対面：本人限定受取郵便',
  NONFACE_ID_IMAGE_PLUS: '非対面：身分証画像＋転送不要書留',
  NONFACE_IC_CHIP: '非対面：ICチップ情報送信',
  NONFACE_E_SIGNATURE: '非対面：電子署名・公的個人認証',
};

export const ID_DOCUMENT_LABEL: Record<string, string> = {
  DRIVERS_LICENSE: '運転免許証', MY_NUMBER_CARD: 'マイナンバーカード',
  PASSPORT: 'パスポート', RESIDENCE_CARD: '在留カード',
  HEALTH_INSURANCE: '健康保険証', OTHER: 'その他',
};
