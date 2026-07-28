# TASKS.md — 実装順序

各タスク完了時: `npm run build && npm run test` を通してからコミット。コミットメッセージは `feat(T01): ...` 形式。

> ⚠️ **2026-07-28 監査: 既存 app/ 実装と仕様の乖離（着手前に必ず解消）**
> 現在の `app/supabase/migrations/` は仕様(specs/01)と一致していない。**仕様が正**。T02再構築で以下を必ず直す。詳細は `docs/KONCOCHII_開発整合性監査.html`。
> - テーブル不足：`staff / price_plans / fee_settings / booking_items / pickup_otps / capacity_holds / partners / insurance_addons / inquiries / ota_vouchers` が未作成（現状 stores/bookings/payments/otp_challenges/audit_logs のみ）。
> - **OTPテーブルの誤設計**：現状は `otp_challenges` 1本に drop-off/pickup を `purpose` で混在。specs/06は「drop-off OTP流用不可＝**別テーブル検証**」を要求。→ `bookings.dropoff_otp_hash`（ハッシュ列）＋独立した `pickup_otps`（`otp_hash` + **`otp_plain`** 有効期間限定・06のOTP不達対策）に分離必須。
> - `payments` 独自テーブルは仕様に無い（決済参照は `bookings.payment_ref` 等）。仕様に合わせる。
> - **Drizzle未導入**：specs/11はDrizzle ORM確定だが app は生 supabase-js。T02でDrizzle導入し、`supabase/migrations/` を正としてschemaを合わせる。
> - `audit_logs.id` は仕様では `bigint identity`（現状 uuid）。actor列名も specs/01 に合わせる。

## Phase 1: 基盤

- [ ] **T01** プロジェクト初期化: Next.js(App Router, TS strict)+ Tailwind + next-intl(en/vi/ja)+ ESLint/Vitest。`/`, `/store`, `/admin` のプレースホルダページ
- [ ] **T02** Supabase セットアップ: `specs/01-data-model.md` のマイグレーション+seed。RLS全テーブル有効化(anon全拒否)。`lib/db.ts`(service roleクライアント、サーバー専用)
- [ ] **T03** 共通基盤: zodエラーハンドラ、audit_logsヘルパー、レート制限、`lib/payment/`(PaymentProviderインターフェース+MockProvider、本番用twoc2pスタブ=specs/10)、メール送信抽象(`lib/mail/`、devはconsole出力)
- [ ] **T03c** API契約モジュール `src/contracts/`(specs/13): common/user/store/admin の zodスキーマ+`z.infer`型、共通`ApiError`、型付き`lib/api-client.ts`。以降の全APIはこの契約を入口/出口で`parse`する

## Phase 2: 予約(利用者)

- [ ] **T04** `GET /stores` + 店舗検索画面(残容量計算含む)
- [ ] **T05** `POST /quotes` + プラン選択画面(到着枠の営業時間内フィルタ含む)
- [ ] **T06** `POST /bookings`(容量ロック直列化・決済・OTP生成・状態遷移・idempotency)+ ユニットテスト(容量競合・決済失敗・スナップショット)
- [ ] **T07** 予約完了/マイ予約ページ `/b/[token]`(QR生成・OTP初回表示・再送・キャンセル)+ 確認メールテンプレ
  - **T07b (06 OTP不達対策)**: 有効期間内(10分/未使用)の pickup OTP を予約ページに表示(`activePickupOtp`=specs/13、閲覧を audit `PICKUP_OTP_VIEWED`)／`PATCH /bookings/:token/email`(全item awaiting_dropoff時のみ・新旧両アドレスへ `email_changed` 通知=specs/14)／checkout画面の禁止物文言・所有物宣言チェック(specs/03・12.10-C-1)

## Phase 3: 店舗オペレーション

- [ ] **T08** 店舗Auth+スタッフコードセッション+`/store` ホーム(保管中一覧・ポーリング)
  - **specs/16 準拠**: role/store_id は JWT `app_metadata`(user_metadataは認可に使わない)／`/store/*`は role='store'・不一致/未ログインは**404**(存在秘匿)／store_idはJWTを正・ボディの店舗指定は信用しない／`must_change_password` の店舗は変更完了までmiddlewareで全画面ブロック／スタッフコード15分ゲート(サーバーセッション、localStorage不可)・毎API `x-staff-code`照合／ban済みは次API呼出から拒否／ログイン5回失敗/15分ロック
- [ ] **T09** 預かるフロー: QRスキャン・`verify-dropoff`(失敗カウント/ロック)・`checkin`(タグ+写真必須・Storage・期限計算)
  - **禁止物/開披/利用拒否(specs/04・12.10-C/C-1)**: 受入拒否ボタン(prohibited_item)／利用拒否事由の記録／開披(責任者立会い)の audit 記録／写真は端末に残さずアップロード後破棄／サイズ修正(12.10-B)
- [ ] **T10** 返すフロー: `request-pickup-otp`(メール送信)・`checkout`(部分受け取り・overtime精算チェック)
- [ ] **T11** Cronジョブ3種(no-show / overdue / abandoned)+ ユニットテスト(境界時刻)

## Phase 4: 管理

- [ ] **T12** adminロール認可+ダッシュボード(KPI・店舗別・収益内訳)
- [ ] **T13** 予約管理(検索・詳細・auditタイムライン・手動キャンセル・ロック解除)
- [ ] **T14** 精算(月次集計+CSV)+ 店舗/料金/スタッフのマスタ管理
  - **アカウント管理(specs/16)**: 店舗アカウント作成(Admin API・app_metadataにrole/store_id・初回パスワード自動発行+`must_change_password`)／ban・強制リセット／スタッフコードの自動生成(4桁・弱い並び/重複回避)・失効・再有効化(削除/再割当なし)。関連 audit 記録
- [ ] **T14b** 日次レポート(店舗×日別: 預かり数/キャンセル内訳/売上、CSV)+ 店舗ホームの本日カウンタ

## Phase 5: 集客チャネル(specs/07)

- [ ] **T15a** 店舗SEO公開ページ(SSG・構造化データ・hreflang・sitemap)+ 流入元トラッキング(ref/UTM→bookings.channel)
- [ ] **T15b** ウォークイン短縮フロー(店舗ポスターQR→プリセット予約)。※追加補償オプションはPoCスコープ外(将来)。スキーマのみ先行
- [ ] **T15c** パートナー管理+POP/ポスターPDF生成、問い合わせフォーム+管理画面、レビュー依頼メールcron

## Phase 6: 仕上げ

- [ ] **T15** i18n全キー整備(en/vi/ja完備、ko/zh-CN/zh-TW/hiはenフォールバック)、モバイル実機幅(375px)確認、Lighthouseでパフォーマンス確認
- [ ] **T16** E2Eシナリオテスト(Playwright): **specs/15 の E1〜E15＋E14b(認証/アカウント)＋E14c(OTP不達回避策) を実装**(時刻注入・cron手動起動・メールモックを利用)。全Greenが完了条件
- [ ] **T17** セキュリティ自己監査: `specs/06-security.md` の全項目をチェックリスト化して検証結果を `SECURITY_AUDIT.md` に記録

## Open Questions(実装中に判断したことを追記)

- (例)〜は仕様に記載がないため〜と実装した
