# KONCOCHII — Luggage Storage Web App (PoC)

ホーチミン市のコンビニ提携型・荷物預かりサービス。インストール不要のWebアプリ。

## このリポジトリの読み方

実装前に `specs/` を必ず読むこと。読む順序:

1. `specs/00-overview.md` — アーキテクチャ・用語・状態機械
2. `specs/01-data-model.md` — DBスキーマ(Supabase/PostgreSQL)
3. `specs/02-api.md` — APIエンドポイント定義
4. `specs/03-user-booking.md` / `04-store-ops.md` / `05-admin.md` — 機能仕様
5. `specs/06-security.md` — OTP/認可/RLSルール(必読・最優先)
6. `specs/11-tech-stack.md` — 技術選定・環境設定(確定。DB=Supabase Cloud/Postgres, ORM=Drizzle, host=Vercel)
7. `TASKS.md` — 実装順序。この順に実装する

仕様と実装が矛盾したら仕様が正。仕様に不足があれば TASKS.md 末尾の「Open Questions」に追記して、妥当なデフォルトで進める。

## 技術スタック

- Next.js 14+ (App Router, TypeScript strict)
- Supabase (PostgreSQL)。エンドユーザーはアカウントレス(ゲスト予約)。店舗・管理者はSupabase Auth
- Tailwind CSS
- 決済: PSP抽象インターフェース (`lib/payment/`)。対応6方式=Visa/Mastercard・Apple Pay・Google Pay・VietQR・MoMo。PoCはモックプロバイダで全方式を再現。本番はVietQR/MoMoを扱える現地アグリゲータ想定(specs/03参照)。`PAYMENT_PROVIDER` env で差し替え
- QR生成: `qrcode` npm / QR読取: ブラウザ `BarcodeDetector` + フォールバック `html5-qrcode`
- i18n: `next-intl`。7ロケール: en, vi, ja, ko, zh-CN, zh-TW, hi(初期実装は en/vi/ja、残りはキーのみ用意)

## コマンド

```bash
npm run dev            # 開発サーバー
npm run build          # ビルド(コミット前に必ず通すこと)
npm run lint           # ESLint
npm run test           # Vitest(ユニット)
npx supabase db reset  # マイグレーション再適用+seed
```

## 規約

- 金額は常に VND 整数(小数なし)。DBは `bigint`、表示は `Intl.NumberFormat`
- 日時はDBでは `timestamptz`(UTC)、表示はホーチミン時間 (`Asia/Ho_Chi_Minh`) 固定
- ID: 予約番号は `KC-` + 6桁連番。内部キーは `uuid`
- ビジネスロジック(料金計算・OTP検証・状態遷移)はすべてサーバー側。クライアントでは行わない
- 状態遷移は `specs/00-overview.md` の状態機械に厳密に従う。定義外の遷移は409エラー
- コミット単位は TASKS.md のタスク単位。各タスク完了時に `npm run build && npm run test` を通す
