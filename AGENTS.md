# AGENTS.md — KONCOCHII (Codex/エージェント向け規約)

このリポジトリで作業する AI エージェント（Codex 等）への指示。詳細な規約は `spec/CLAUDE.md` を参照。

## 読む順序（作業前に必読）

1. `spec/CLAUDE.md` — プロジェクト規約・技術スタック・コマンド
2. `spec/specs/00-overview.md` — アーキテクチャ・状態機械・料金・時間ルール
3. `spec/specs/01-data-model.md` — DBスキーマ（DDL）
4. `spec/specs/02-api.md` — API定義
5. `spec/specs/03-user-booking.md` / `04-store-ops.md` / `05-admin.md` — 機能仕様
6. `spec/specs/06-security.md` — OTP/認可/RLS（**最優先で厳守**）
7. `spec/specs/07-growth-channels.md` / `08-ota-integration.md` / `09-source-coverage.md` / `10-payment-provider.md`
8. `spec/specs/11-tech-stack.md` — 技術選定・環境設定（**確定**。DB=Supabase Cloud/Postgres・ORM=Drizzle・host=Vercel）
9. `spec/specs/12-domain-rules-and-fixtures.md` — ドメインルール＆期待値（**入力→期待出力表をそのままユニットテストにする**）
10. `spec/specs/13-api-contracts.md` — API契約（zodスキーマ=型=バリデーションの**単一ソース**。手書き型禁止・`z.infer`で共有）
11. `spec/specs/14-notifications.md` — 通知・メールテンプレ（一覧/タイミング/変数/`notification_templates`マスタ）
12. `spec/specs/15-acceptance-tests.md` — 受け入れテスト計画（E2Eシナリオ。**全Greenが各Phaseの完了条件**）
13. `spec/TASKS.md` — 実装順（この順に実装）

仕様と実装が矛盾したら **仕様が正**。不足は `spec/TASKS.md` 末尾の Open Questions に追記し、妥当なデフォルトで進める。

## 実装場所

- アプリは **リポジトリ直下の `app/`** に新規 Next.js プロジェクトとして作る。
- `docs/`（資料サイト）・`spec/`（仕様）・`requirements/`（要件定義）は**変更しない**。

## 技術スタック

Next.js 14+（App Router, TypeScript strict）/ Supabase（PostgreSQL）/ Tailwind CSS / next-intl（en, vi, ja を先行）/ zod / 決済は `lib/payment/` 抽象（PoC=MockProvider、本番=2C2P）/ QR=`qrcode`＋読取は BarcodeDetector＋html5-qrcode フォールバック。

## コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # ビルド（コミット前に必ず通す）
npm run lint     # ESLint
npm run test     # Vitest
npx supabase db reset  # マイグレーション再適用+seed
```

## 厳守ルール

- 金額は VND 整数（`bigint`）。日時は DB=UTC(`timestamptz`)、表示は `Asia/Ho_Chi_Minh`。
- 料金計算・OTP検証・状態遷移など**ビジネスロジックはすべてサーバー側**。クライアントで行わない。
- 状態遷移は 00-overview の状態機械に厳密に従う。定義外は 409。
- **秘密情報（service role key 等）はコミットしない**。`.env.example` を用意し、README に手順を書く。
- 各タスク完了時に `npm run build && npm run test` を通してから、タスク単位でコミット（`feat(T0x): ...`）。
- カード情報は保持しない（PSPトークンのみ）。ログに PII/OTP を出さない。
