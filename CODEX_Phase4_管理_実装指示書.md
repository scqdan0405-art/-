# Codex 指示書 — Phase 4（管理 T12〜T14b）

作成: 2026-07-28 ／ 前提: Phase2 完了・Phase3(T09〜T11)＆決済＆チャネル/OTA適用の後に着手推奨。仕様が正（specs 02/05/16、01のsales_channels/channel_code、08）。AGENTS.mdのGit運用。各ステップで `npx supabase db reset && npm run build && npm run test`、自分の回帰は自分で直す。

## 共通
- **`/admin/*` は `app_metadata.role='admin'`。無い/不一致は 404**（存在秘匿・specs/16）。
- メール・電話は一覧でマスク、フル表示は詳細ドロワーのみ（specs/06）。PII/OTPをログに出さない。
- 金額VND整数、時刻表示は Asia/Ho_Chi_Minh。CSVは UTF-8 **BOM付き**（Excelで開ける）。

## T12 ダッシュボード（`GET /api/v1/admin/dashboard?from&to`）
- KPIカード: 総予約数 / 保管中item数 / 総売上VND / 返却完了数 / no-show数。
- 店舗別テーブル: 予約数・売上・**稼働率**（使用ポイント÷容量ポイントの日平均）。
- **収益内訳(自動)**: 売上 − 店舗40% − 決済3% − 保険6% − システム5% = 純収益。**率は fee_settings 化されていない固定率でよいが定数を1箇所に**（将来 fee_settings 化できるよう）。
- daily_storage_fee_vnd が null の間は「日額未設定」警告を表示。

## T13 予約管理（`/admin/bookings`）
- 検索: 予約番号 / メール / 電話（部分一致）、状態・店舗・期間フィルタ、ページング50件。
- 詳細ドロワー: 予約全項目 ＋ item一覧（タグ・写真・状態）＋ **audit_logs タイムライン**。**channel（粗）と channel_code（具体OTA名）を表示**。
- 操作: 手動キャンセル（返金額入力＋理由必須・**paidのみ**）／ OTPロック解除。すべて audit 記録。

## T14 精算＋マスタ管理＋アカウント管理
### 精算 `/admin/settlement?month=YYYY-MM`
- 店舗別: grossVnd / commission40 / paymentFee3% / insurance6% / system5% / netVnd。`?format=csv`（BOM）。
- **チャネル別 gross を分離**（direct と ota を別集計＝OTA入金突合用。specs/08）。
### マスタ `/admin/stores` ほか
- 店舗（有効/無効・容量・営業時間）。
- **price_plans**: 新 `valid_from` 行を追加する方式（過去行は編集不可＝スナップショット整合）。**channel_tier(direct/ota) 別**に管理。
- **fee_settings**: 超過単価/打ち止め/**日額(null時は未設定警告・0扱い)**/キャンセル/no-show/移送日数/補償上限を editable（effective_from で改定履歴）。
- **通知テンプレ `/admin/templates`**（specs/14）: キー×ロケールの件名/本文編集・変数一覧・プレビュー・有効/無効。
- **sales_channels 管理（新規・specs/01/08）**: OTA/流入チャネルの登録・編集（code/name/type/commission_rate/supports_voucher/is_active）。**新しいOTA(Agoda等)はここで1行追加**＝コード改修不要。
### アカウント管理（specs/16）
- 店舗アカウント: 作成（Admin API・app_metadataにrole/store_id・初回PW自動発行＋`must_change_password`）／ban／強制リセット。
- スタッフコード: 自動生成（4桁・弱い並び/重複回避）・失効・再有効化（削除/再割当なし）。関連 audit 記録。

## T14b 日次レポート（`GET /api/v1/admin/daily?from&to&storeId`）
- 店舗×日別: 日付/店舗/預かり件数(その日stored)/S・M・L内訳/返却完了/キャンセル(no-show・利用者別掲)/超過発生/売上VND/**チャネル別内訳**。
- **チャネル内訳は粗カテゴリ(direct/organic/ota/referral/store/sns)＋ドリルダウンで channel_code 別(trip/klook/agoda…)**（specs/05・07・レジストリ由来）。`?format=csv`（BOM）。
- 店舗 `/store` ホームの「本日の預かり/返却」カウンタと数値整合。

## 受け入れ基準（specs/05）
- [ ] adminロール無しは /admin 全ページ・APIで404。
- [ ] 精算CSV合計＝ダッシュボード売上。CSVがExcelで文字化けしない（BOM）。
- [ ] 料金改定後も既存予約金額が不変（スナップショット）。
- [ ] fee_settings 変更が以後の計算に反映、既存スナップショットは不変。daily=null で未設定警告。
- [ ] 手動キャンセルで capacity_holds 解放。
- [ ] **sales_channels に1行追加すると、その channel_code で予約・集計できる（Agoda等が改修なしで載る）**。
- [ ] `npm run build && npm run test` 緑。push後にコミットID・確認URL・テスト結果を報告。

## Codex に貼るプロンプト
```
Phase 4（管理 T12〜T14b）を specs 02/05/16/01/08・CODEX_Phase4_管理_実装指示書.md に沿って実装。
- /admin/* は role=admin、無しは404。PIIマスク、CSVはBOM付き。
- T12 ダッシュボード(KPI/店舗別/稼働率/収益内訳/daily未設定警告)
- T13 予約管理(検索/詳細ドロワー+auditタイムライン+channel&channel_code表示/手動キャンセルpaidのみ/ロック解除)
- T14 精算(店舗別+チャネル別gross分離+CSV BOM)、マスタ(price_plansはvalid_from追加方式&channel_tier別/fee_settings daily=null警告/通知テンプレ/**sales_channels管理=新OTAは行追加**)、アカウント管理(店舗作成/ban/強制PWリセット、スタッフコード自動生成/失効=specs16)
- T14b 日次レポート(店舗×日/粗チャネル+channel_codeドリルダウン/CSV BOM)、店舗ホーム本日カウンタと整合
- 各タスク db reset&build&test→commit→push。E2E specs/15 E14/E14b/E15相当を通し、コミットID・確認URL・結果を報告して止まる。
```
