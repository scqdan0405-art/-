# TASKS.md — 実装順序

各タスク完了時: `npm run build && npm run test` を通してからコミット。コミットメッセージは `feat(T01): ...` 形式。

## Phase 1: 基盤

- [ ] **T01** プロジェクト初期化: Next.js(App Router, TS strict)+ Tailwind + next-intl(en/vi/ja)+ ESLint/Vitest。`/`, `/store`, `/admin` のプレースホルダページ
- [ ] **T02** Supabase セットアップ: `specs/01-data-model.md` のマイグレーション+seed。RLS全テーブル有効化(anon全拒否)。`lib/db.ts`(service roleクライアント、サーバー専用)
- [ ] **T03** 共通基盤: zodエラーハンドラ、audit_logsヘルパー、レート制限、`lib/payment/`(PaymentProviderインターフェース+MockProvider、本番用twoc2pスタブ=specs/10)、メール送信抽象(`lib/mail/`、devはconsole出力)

## Phase 2: 予約(利用者)

- [ ] **T04** `GET /stores` + 店舗検索画面(残容量計算含む)
- [ ] **T05** `POST /quotes` + プラン選択画面(到着枠の営業時間内フィルタ含む)
- [ ] **T06** `POST /bookings`(容量ロック直列化・決済・OTP生成・状態遷移・idempotency)+ ユニットテスト(容量競合・決済失敗・スナップショット)
- [ ] **T07** 予約完了/マイ予約ページ `/b/[token]`(QR生成・OTP初回表示・再送・キャンセル)+ 確認メールテンプレ

## Phase 3: 店舗オペレーション

- [ ] **T08** 店舗Auth+スタッフコードセッション+`/store` ホーム(保管中一覧・ポーリング)
- [ ] **T09** 預かるフロー: QRスキャン・`verify-dropoff`(失敗カウント/ロック)・`checkin`(タグ+写真必須・Storage・期限計算)
- [ ] **T10** 返すフロー: `request-pickup-otp`(メール送信)・`checkout`(部分受け取り・overtime精算チェック)
- [ ] **T11** Cronジョブ3種(no-show / overdue / abandoned)+ ユニットテスト(境界時刻)

## Phase 4: 管理

- [ ] **T12** adminロール認可+ダッシュボード(KPI・店舗別・収益内訳)
- [ ] **T13** 予約管理(検索・詳細・auditタイムライン・手動キャンセル・ロック解除)
- [ ] **T14** 精算(月次集計+CSV)+ 店舗/料金/スタッフのマスタ管理
- [ ] **T14b** 日次レポート(店舗×日別: 預かり数/キャンセル内訳/売上、CSV)+ 店舗ホームの本日カウンタ

## Phase 5: 集客チャネル(specs/07)

- [ ] **T15a** 店舗SEO公開ページ(SSG・構造化データ・hreflang・sitemap)+ 流入元トラッキング(ref/UTM→bookings.channel)
- [ ] **T15b** ウォークイン短縮フロー(店舗ポスターQR→プリセット予約)。※追加補償オプションはPoCスコープ外(将来)。スキーマのみ先行
- [ ] **T15c** パートナー管理+POP/ポスターPDF生成、問い合わせフォーム+管理画面、レビュー依頼メールcron

## Phase 6: 仕上げ

- [ ] **T15** i18n全キー整備(en/vi/ja完備、ko/zh-CN/zh-TW/hiはenフォールバック)、モバイル実機幅(375px)確認、Lighthouseでパフォーマンス確認
- [ ] **T16** E2Eシナリオテスト(Playwright): 予約→預け入れ→部分返却→超過→完了 のハッピーパス+OTPロック
- [ ] **T17** セキュリティ自己監査: `specs/06-security.md` の全項目をチェックリスト化して検証結果を `SECURITY_AUDIT.md` に記録

## Open Questions(実装中に判断したことを追記)

- (例)〜は仕様に記載がないため〜と実装した
