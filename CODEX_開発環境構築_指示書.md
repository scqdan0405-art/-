# Codex 指示書 — KONCOCHII 開発環境の構築

このファイルは、Codex に「KONCOCHII の開発環境を作らせる」ための指示です。
リポジトリ直下（`spec/` がある場所）で Codex を起動し、下の「① 最初に貼る指示」をそのまま貼ってください。

---

## 前提（Codex に渡す環境情報）

- 対象リポジトリ: LingBridge（`spec/` に仕様、`docs/` に資料サイト、`requirements/` に要件定義）
- 仕様の正: `spec/CLAUDE.md` と `spec/specs/*.md`、実装順は `spec/TASKS.md`
- 技術スタック（`spec/CLAUDE.md` より）: Next.js 14+（App Router, TypeScript strict）/ Supabase / Tailwind CSS / next-intl / zod / 決済は `lib/payment/` 抽象（PoCはモック、本番は 2C2P）
- 実装は `app/` 配下の新規 Next.js プロジェクトとして作成する（既存の `docs/` `spec/` `requirements/` は触らない）

---

## ① 最初に貼る指示（このブロックをそのまま Codex に貼る）

```
あなたは KONCOCHII の開発を担当します。まず以下を読んでください。
- spec/CLAUDE.md（プロジェクト規約・技術スタック・コマンド）
- spec/specs/00-overview.md 〜 10-payment-provider.md（仕様。06-security は最優先で厳守）
- spec/TASKS.md（実装順）

その上で、リポジトリ直下に app/ というサブフォルダを作り、そこに Next.js アプリを新規構築してください
（docs/ spec/ requirements/ は変更しないこと）。

今回のゴールは「開発環境の構築（Phase 1: 基盤）」までです。具体的には TASKS.md の T01〜T03 を実装してください。
1. T01: Next.js 14+（App Router, TypeScript strict）+ Tailwind + next-intl（en/vi/ja）+ ESLint/Vitest を初期化。
   /、/store、/admin のプレースホルダページを作る。
2. T02: Supabase セットアップ。spec/specs/01-data-model.md の DDL を supabase/migrations/ に置き、seed も用意。
   RLS を全テーブル有効化（anon 全拒否）。lib/db.ts（service role、サーバー専用）。
3. T03: 共通基盤。zod エラーハンドラ、audit_logs ヘルパー、レート制限、
   lib/payment/（PaymentProvider インターフェース + MockProvider + twoc2p スタブ）、
   メール送信抽象 lib/mail/（開発時は console 出力）。

進め方のルール：
- 秘密情報（Supabase の service role key 等）はコミットしない。.env.example を作り、README に設定手順を書く。
- 各タスク完了時に `npm run build` と `npm run test` が通ることを確認し、タスク単位でコミット
  （コミットメッセージは feat(T01): ... の形式）。
- 仕様に不足があれば spec/TASKS.md 末尾の Open Questions に追記し、妥当なデフォルトで進める。
- 実装中に判断したこと・前提はコミットメッセージか Open Questions に必ず残す。

T03 まで終わったら、いったん止めて次を報告してください：
- 作成したファイル構成の概要
- ローカルでの起動手順（npm install → 環境変数 → supabase → npm run dev）
- 未解決点（Open Questions）
私が確認したら、Phase 2（予約フロー T04〜T07）に進みます。
```

---

## ② 環境構築後、Codex に確認してほしいこと（受け入れ基準）

Codex が T03 まで完了したと言ったら、次を満たしているか確認してください。

- `app/` に Next.js プロジェクトができ、`npm install && npm run build` が成功する
- `npm run dev` で起動し、`/`・`/store`・`/admin` が表示される（プレースホルダで可）
- `npm run lint` と `npm run test` が通る
- `supabase/migrations/` に 01-data-model.md 相当の DDL がある
- `.env.example` があり、実際の秘密情報はコミットされていない（`git log`・`git show` で確認）
- `lib/payment/`（MockProvider）と `lib/mail/`（console）と `lib/db.ts` がある

---

## ③ 続きの進め方（Phase 2 以降）

環境が整い動作確認できたら、同じ Codex セッションに次を貼って続行します。

```
Phase 2 に進みます。spec/TASKS.md の T04〜T07（店舗検索→見積→予約・決済→予約完了/マイ予約）を、
spec/specs/02-api.md・03-user-booking.md・06-security.md に従って実装してください。
T06（予約作成）は容量ロックの直列化・決済・OTP生成・状態遷移・冪等性のユニットテストも必ず書くこと。
各タスクごとに build/test を通してコミットし、T07 まで終わったら報告してください。
```

以降 Phase 3（店舗 T08〜T11）、Phase 4（管理 T12〜T14b）、Phase 5（集客 T15a〜T15c）、Phase 6（仕上げ T15〜T17）も
同様に「Phase 単位で指示 → 動作確認 → 次へ」で進めます。

---

## ④ 補足

- **AGENTS.md**: 同梱の `AGENTS.md` をリポジトリ直下に置くと、Codex が自動で規約を読み込みます（`spec/CLAUDE.md` の要約版）。
- **Supabase をローカルで動かす場合**: Docker が必要です（`npx supabase start`）。クラウドの無料プロジェクトを使う場合は URL とキーを `.env.local` に設定します。
- **決済**: PoC は MockProvider で動きます。2C2P の実接続は契約後（`spec/specs/10-payment-provider.md`）。
- 迷ったら「仕様（spec/）が正、秘密はコミットしない、各タスクで build/test を通す」の3つを守らせてください。
