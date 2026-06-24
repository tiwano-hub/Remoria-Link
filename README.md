# Remoria Link

出張買取向けの **案件管理・電子契約・在庫管理・分析** システム。

日本国内の関連法令（古物営業法・電子帳簿保存法・個人情報保護法）に準拠する設計を目指しています。

## 技術構成

| 領域 | 技術 |
| --- | --- |
| フロントエンド | React + Vite + TypeScript |
| バックエンド | Node.js + Express + TypeScript |
| DB | PostgreSQL (Prisma ORM) |
| 認証 | Google OAuth 2.0 (ID Token 検証) + JWT セッション |
| デプロイ | Render |
| ソース管理 | GitHub |

## ディレクトリ構成

```
Remoria-Link/
├── backend/          Express API (TypeScript)
│   ├── prisma/       Prisma スキーマ / マイグレーション / シード
│   └── src/
│       ├── routes/       API ルート
│       ├── middleware/   認証 / 権限 / 監査ログ
│       ├── services/     PDF・税計算・在庫採番などのドメインロジック
│       └── lib/          Prisma クライアント等の共有モジュール
├── frontend/         React + Vite SPA
│   └── src/
│       ├── pages/        各画面
│       ├── components/   共通 UI
│       └── api/          API クライアント
└── render.yaml       Render Blueprint
```

## セットアップ（ローカル）

### 1. 前提

- Node.js 20+
- PostgreSQL 14+

### 2. バックエンド

```bash
cd backend
cp .env.example .env   # 値を設定
npm install
npx prisma migrate dev --name init
npm run seed           # マスタ・サンプルユーザー投入
npm run dev            # http://localhost:4000
```

### 3. フロントエンド

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

### 4. Google 認証の設定

1. Google Cloud Console で OAuth 2.0 クライアント ID を作成。
2. 承認済み JavaScript 生成元に `http://localhost:5173`（本番は Render の URL）を追加。
3. クライアント ID を backend / frontend の `.env` に設定。
4. カレンダー連携を使う場合はサービスアカウントまたは OAuth スコープ `https://www.googleapis.com/auth/calendar.events` を設定。

## 権限（ロール）

| ロール | 説明 |
| --- | --- |
| `ADMIN` | 管理者：全機能 |
| `STORE_MANAGER` | 店舗責任者：店舗内の全案件・分析 |
| `APPRAISER` | 査定担当者：担当案件・査定・契約 |
| `BOOKER` | 予約担当者：予約・案件登録 |
| `VIEWER` | 閲覧専用 |

## 法令対応の設計メモ

`docs/COMPLIANCE.md` を参照。古物台帳・契約書・本人確認記録・操作ログの保存期間と
非対面取引（古物営業法施行規則）への対応方針を記載しています。

## MVP の範囲

案件登録 / 顧客検索 / 契約書作成 / 署名 / 身分証登録 / 在庫登録 / 販売実績 /
買取分析 / 販売分析 までが動作する状態を目標としています。
