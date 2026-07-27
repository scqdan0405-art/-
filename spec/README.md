# KONCOCHII 実装仕様パッケージ

Claude Code(またはCodex)にPoC実装させるための仕様一式。

## 使い方(Claude Code)

1. 新しい空のリポジトリを作り、このフォルダの中身をルートに配置する
2. リポジトリでClaude Codeを起動し、次のように指示する:

```
CLAUDE.md と specs/ を読んで、TASKS.md の T01 から順に実装してください。
各タスク完了時に build と test を通してコミットし、次のタスクに進んでください。
仕様に不明点があれば TASKS.md の Open Questions に記録して妥当なデフォルトで進めてください。
```

3. Phase単位で区切って実行し、都度動作確認するのを推奨(T01–T03 → 確認 → T04–T07 → …)

## 事前に必要なもの

- Supabase プロジェクト(無料枠でよい)→ URL / service role key を `.env.local` に設定
- メール送信(Resend無料枠推奨)。なくてもdevはコンソール出力で動く

## 構成

- `CLAUDE.md` — エージェント向けプロジェクト規約
- `specs/00-overview.md` — アーキテクチャ・状態機械・料金・時間ルール
- `specs/01-data-model.md` — DBスキーマ(DDL)
- `specs/02-api.md` — API定義
- `specs/03-user-booking.md` — 利用者機能
- `specs/04-store-ops.md` — 店舗機能
- `specs/05-admin.md` — 管理機能
- `specs/06-security.md` — セキュリティ要件(最優先)
- `specs/07-growth-channels.md` — 集客チャネル(SEO公開ページ・紹介パートナー・ウォークイン・レビュー・問い合わせ)
- `specs/08-ota-integration.md` — OTA連携(Trip.com/Klook/KKday、3段階)
- `specs/09-source-coverage.md` — 原資料カバレッジ表(トレーサビリティ・未確定事項)
- `specs/10-payment-provider.md` — 決済PSP選定(2C2Pに確定・6方式1連携)
- `TASKS.md` — 実装順序(20タスク)

要件定義書v1.1の改訂事項(返却OTP分離・荷物単位ステータス・容量ポイント制・実預け入れ起算・超過24h打ち止め・no-show自動キャンセル等)はすべて反映済み。
