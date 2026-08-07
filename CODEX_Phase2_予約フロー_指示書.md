# Codex 指示書 — Phase 2（予約フロー T04〜T07）

作成: 2026-07-28 ／ 前提: **T02（DBスキーマ再構築）完了後に着手**。仕様が正（specs/）。
主参照: `specs/02-api.md`（API）・`specs/03-user-booking.md`（画面）・`specs/12-domain-rules-and-fixtures.md`（期待値＝テスト元）・`specs/13-api-contracts.md`（zod契約）・`specs/14-notifications.md`（メール）。

## 0. 共通ルール（全タスク厳守）

- **金額計算・OTP生成・状態遷移・容量判定はサーバーのみ**。クライアントで金額を作らない。
- 金額は VND 整数（10,000の倍数）。時刻は DB=UTC(`timestamptz`)、表示・計算基準は `Asia/Ho_Chi_Minh`(UTC+7)固定。
- 全APIは `src/contracts/`（specs/13）の zod で**入口=parse、出口=parse**。エラー形式は `{ error, message }`（specs/02）。
- 純粋ロジックは DB から切り離した関数に閉じ込め、**specs/12 の表をテーブル駆動 Vitest** にする：`lib/pricing.ts` / `lib/overtime.ts` / `lib/capacity.ts` / `lib/state-machine.ts` / `lib/due.ts`。
- ビジネス数値は `fee_settings` / `price_plans` マスタから取得（**ハードコード禁止**）。予約時に使った単価は `booking_items.unit_price_vnd` にスナップショット。
- 各タスクで `npm run build && npm run test` を通してからコミット（`feat(T04): ...`）。秘密はコミットしない。

## 1. T04 — 店舗一覧＋残容量（`GET /api/v1/stores`）

**API**: `GET /api/v1/stores?date=YYYY-MM-DD` → `[{ id, code, name, area, lat, lng, openTime, closeTime, capacityPoints, availablePoints }]`（契約=specs/13）。
- `availablePoints` は指定日の**表示用**目安。**正の容量判定は予約作成時に区間の重なりで再計算**（T06・12.4）。表示は「その日に重なりうるホールドの最大同時ポイント」を近似してよいが、予約可否の最終決定には使わない。
- 画面 `/[locale]/`（specs/03 画面1）: 店舗カード（名称・エリア・営業時間・残容量バッジ）、日付選択（今日〜7日先）、`availablePoints≥3`=緑／1–2=橙／0=赤(選択不可)。地図は Google Maps URL の静的リンク。
- **受入**: [ ] 満杯(0)店舗は選択不可。[ ] 日付変更で残容量再取得。[ ] 文言は i18n キー経由（en/vi/ja）。

## 2. T05 — 見積＋プラン選択（`POST /api/v1/quotes`）

**API**: `POST /api/v1/quotes`（契約 `QuoteRequest`/`QuoteResponse`）。**見積は保存しない**。予約時に再計算し一致検証。
- `lib/pricing.ts`：`bookingTotal(items, planHours, channelTier='direct')= Σ price(size,planHours,channelTier)`。**specs/12.1 の P1〜P6 をユニットテスト**（direct・S=50/70/100・M=70/100/150・L=100/150/200千VND）。※チャネル対応は OTAガードレール G2（`CODEX_OTA準備_ガードレール指示書.md`）。PoCは常に direct。
- PoCでは `insuranceAddonId` は送らない（`insuranceAddonVnd=0`・基本補償のみ）。
- 画面 `/[locale]/book/[storeCode]`（specs/03 画面2）:
  - サイズ S/M/L の個数を +/−（合計1〜5個）。**サイズ目安を表示（非重複）**：S=20kg以下 / M=20kg超〜30kg以下 / L=29in以上または30kg超。「実物が違えば店頭でサイズ修正・差額精算」注記。
  - プラン 3/6/12h 選択 → `POST /quotes` で合計表示。
  - **到着時間帯（1時間枠）**：店舗営業時間内、かつ「枠開始+planHours」が営業時間内に収まる枠のみ表示（閉店またぎ防止）。PoC3店舗は24hなので全枠可だが、ロジックは営業時間を引数に取る形で実装（将来の非24h店に耐える）。
  - 注意文：超過10,000VND/h(最大24h)・基本補償込み(1荷物500万VND)・禁止物。
- **受入**: [ ] 見積金額が12.1と一致。[ ] 営業時間外・閉店またぎの枠が出ない。

## 3. T06 — 予約作成＋決済（`POST /api/v1/bookings`）★最重要

**API**: `POST /api/v1/bookings`（`Idempotency-Key` ヘッダ必須。契約 `CreateBookingRequest`/`CreateBookingResponse`）。
`disclaimerAccepted` / `prohibitedItemsAcknowledged` / `ownershipDeclared` は `literal(true)`（未同意は 400）。

**処理順（1トランザクション）**:
1. 見積再計算（12.1）→ リクエスト整合検証。
2. **容量ロック（12.4・最重要）**：対象店舗の該当**区間 [arrivalSlotStart, arrivalSlotStart+planHours)** に重なる有効ホールド(released=false)を `SELECT ... FOR UPDATE` 等で直列化 → `Σpoints + 新規points ≤ capacity_points` を確認。超過は `CAPACITY_FULL(409)`。
3. `bookings`/`booking_items`/`capacity_holds` を `pending_payment` で作成（単価スナップショット）。
4. PSP決済（`lib/payment` の Provider。PoCは Mock：`4000`終わりカード=失敗、その他成功）。
5. 成功→`paid`＋**drop-off OTP生成**（6桁 `crypto.randomInt`、bcrypt cost10で `dropoff_otp_hash` に保存・**平文は保存しない**）＋確認メール（`booking_confirmation`＝QRリンク＋OTP）。
6. 失敗→`payment_failed`、容量ホールド解放。
- **Res 201**: `{ bookingNo, bookingToken, dropoffOtp }`（**平文OTPはこのレスポンスと確認メールのみ**）。`bookingNo` は `KC-`+6桁連番、`bookingToken` は uuid。
- **冪等性（12.8）**：同一 `Idempotency-Key` の再送は同一bookingを返す（予約・決済・ホールド各1件）。異なるKeyは別予約。

**必須ユニット/統合テスト**:
- [ ] 容量：12.4 の C1〜C5（特に **C4 夜またぎ**）。
- [ ] **同時実行**：重なり合計18・cap20 で同区間 M(2pt)2件同時 → 片方成功・片方 `CAPACITY_FULL`（合計がcap超えない）。
- [ ] 決済失敗 → `payment_failed`＋ホールド解放。
- [ ] スナップショット：料金改定後も既存予約金額が不変。
- [ ] 冪等性 I1/I2（12.8）。

## 4. T07 — 予約完了 / マイ予約（`/[locale]/b/[token]`）＋ 確認メール

**画面**（specs/03 画面4 ＝ マイ予約兼用）:
- QR表示：ペイロードは `bookingToken` のみ（**OTPを含めない**・`qrcode` npm）。
- drop-off OTP 6桁を大きく表示（**このページ初回とメールのみ**。再訪時は「メール参照」＋再送ボタン）。
- 予約サマリ・荷物ごとのステータス・返却期限・超過（発生時は赤字）。
- ボタン：確認メール再送（`POST /bookings/:token/resend`、3回/時）／キャンセル（**預入前=awaiting_dropoffのみ**、確認ダイアログ→`refund = total − cancellation_fee_vnd(20,000)` 明示）。
- `GET /bookings/:token`：booking＋items（drop-off OTPは含めない）。
- メール `booking_confirmation`（ロケール別・specs/14）。dev は console 出力。

### T07b — OTP不達回避策・禁止物UI（specs/06・03・12.10-C-1）
- **予約ページに pickup OTP を表示**：`GET /bookings/:token` の `activePickupOtp`（有効期間内10分・未使用の時のみ非null＝specs/13）を表示（「店頭でスタッフに伝えてください」）。閲覧時 audit `PICKUP_OTP_VIEWED`。
- **メール修正**：`PATCH /api/v1/bookings/:token/email`（`UpdateEmailRequest`）。**全item awaiting_dropoff のときのみ**可（それ以外 409）。新旧両アドレスへ `email_changed` 通知（specs/14）＋audit。3回/時。
- **予約画面のチェック（03）**：禁止物「現金・パスポート/身分証・貴重品/宝石/ブランド品・PC/スマホ等電子機器・データ/記録媒体・危険物・生もの」不所持（必須）＋所有物宣言（必須）。電子機器・記録媒体は**禁止物**（申告違反は補償対象外＝12.10-C-1）。
- **受入**: [ ] QRに `bookingToken` のみ（OTP非含有）。[ ] キャンセルは awaiting_dropoff のみ。[ ] 発行後10分以内は予約ページにOTP表示、期限切れ/使用後は非表示。[ ] 預入前メール修正で新旧両宛通知、stored後は409。

## 5. Phase 2 完了時の報告（受け入れ基準・specs/03/15）

以下を満たしたら止めて報告：
- [ ] 満杯店舗で予約不可。同時予約の競合でも容量超過予約が作られない（C4・レース）。
- [ ] 決済失敗で `payment_failed`＋容量解放。
- [ ] 完了ページQRは `bookingToken` のみ（OTP非含有）。
- [ ] キャンセルは `awaiting_dropoff` のみ。stored以降は不可（UIにも出さない）。
- [ ] 見積・合計・no-show返金が **specs/12（P/N系）** と一致（ユニットテストGreen）。
- [ ] 全文言 i18n キー経由（en/vi/ja 完備）。
- [ ] `npm run build && npm run test` 通過。関連E2E（specs/15 E1〜E4・E12・E14c）が実装済み or 次フェーズで実装予定として明記。

## 6. Codex に貼るプロンプト（そのまま貼る）

```
T02完了を確認済みとして、Phase 2（予約フロー T04〜T07）を実装してください。
CODEX_Phase2_予約フロー_指示書.md と specs/02,03,12,13,14 を確定仕様として読むこと。

必須:
- 金額/OTP/状態遷移/容量はサーバーのみ。契約(src/contracts=specs/13)で入口・出口をparse。
- lib/pricing.ts, lib/overtime.ts, lib/capacity.ts, lib/state-machine.ts を純粋関数化し、
  specs/12 の表(P1-P6, O1-O10, D1-D4, C1-C5, N1-N2, I1-I2)をテーブル駆動Vitestで実装。
- T06は容量ロックの直列化(SELECT FOR UPDATE)・決済(Mock)・drop-off OTP生成(bcrypt,平文非保存)・
  冪等性(Idempotency-Key)・同時実行レースのテストを必ず書く。C4夜またぎを落とさない。
- T07/T07bは QRにbookingTokenのみ(OTP非含有)、activePickupOtp表示、PATCH email(預入前のみ・新旧両宛email_changed通知)、
  禁止物+所有物宣言チェック(電子機器・記録媒体も禁止物=12.10-C-1)。
- 各タスクで build && test を通しコミット(feat(T0x): ...)。秘密は非コミット。
- T07まで終えたら §5 の受け入れ基準の結果を報告して止まる。
```
