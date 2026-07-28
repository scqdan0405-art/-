# 02. API仕様(Route Handlers)

すべて `/api/v1/*`。リクエスト/レスポンスはJSON。バリデーションは zod。エラー形式は共通:

```json
{ "error": "ERROR_CODE", "message": "human readable (en)" }
```

主要エラーコード: `VALIDATION_ERROR`(400) / `NOT_FOUND`(404) / `INVALID_TRANSITION`(409) / `CAPACITY_FULL`(409) / `OTP_INVALID`(401) / `OTP_LOCKED`(423) / `PAYMENT_FAILED`(402) / `OVERTIME_UNSETTLED`(409)

## 公開API(利用者・認証なし)

### GET /api/v1/stores?date=YYYY-MM-DD
店舗一覧+指定日の残容量ポイント。
Res: `[{ id, code, name, area, lat, lng, openTime, closeTime, capacityPoints, availablePoints }]`

### POST /api/v1/quotes
料金見積(サーバー計算)。
Req: `{ storeId, visitDate, planHours, items: [{size}], insuranceAddonId?: uuid }`
Res: `{ itemsTotalVnd, insuranceAddonVnd, totalVnd, lines: [{size, unitPriceVnd}], expiresAt }` — 見積は保存しない。予約時に再計算し一致検証

### POST /api/v1/bookings
予約作成+決済実行(1トランザクション)。
Req: `{ storeId, visitDate, arrivalSlotStart, planHours, items:[{size}], insuranceAddonId?: uuid, email, phone, locale, channel?, referralCode?, disclaimerAccepted: true, prohibitedItemsAcknowledged: true, payment: { method: 'card'|'apple_pay'|'google_pay'|'vietqr'|'momo', token } }`
処理順: 容量ロック→bookings/booking_items/capacity_holds作成(pending_payment)→PSP決済→成功で `paid`+drop-off OTP生成→確認メール送信(QRリンク+OTP)。失敗は `payment_failed` にし容量解放。
Res 201: `{ bookingNo, bookingToken, dropoffOtp }` — **OTP平文を返すのはこのレスポンスと確認メールのみ**

### GET /api/v1/bookings/:token
マイ予約(booking_token で照会)。QR再表示・ステータス確認用。
Res: booking + items(status, tagNo, returnDueAt, overtimeFeeVnd)。drop-off OTPは含めない。
**例外**: 有効期間内(10分・未使用)の pickup OTP が存在する場合のみ `activePickupOtp: { otp, expiresAt }` を含める(OTP不達対策、06参照。返却時は audit_logs に PICKUP_OTP_VIEWED を記録)

### POST /api/v1/bookings/:token/resend
確認メール再送。レート制限 3回/時

### PATCH /api/v1/bookings/:token/email
メールアドレス修正(OTP不達対策、06参照)。全itemが `awaiting_dropoff` のときのみ可(それ以外は409)。
Req: `{ email }`(形式検証)。処理: 更新+新旧両アドレスへ通知メール+audit記録。レート制限 3回/時

### GET /api/v1/insurance-addons
有効な追加補償オプション一覧(名称・料金・補償上限)

### POST /api/v1/inquiries
問い合わせ送信。Req: `{ name, email, bookingNo?, body }`。レート制限 3件/時/IP。管理者へメール通知

## 店舗API(要 店舗Auth + `x-staff-code` ヘッダ)

すべての操作で `x-staff-code` を staff テーブルと照合し、audit_logs に actor_id=staff.id を記録。無効なら403。

### POST /api/v1/store/verify-dropoff
Req: `{ bookingToken, otp }` (QR読取値+利用者申告OTP)
検証: booking が自店舗・status=paid・OTPハッシュ一致・ロック中でない。失敗で otp_fail_count++、5回で `otp_locked_until = now()+15min`。
Res: `{ bookingNo, items: [{id, size}], planHours }`

### POST /api/v1/store/checkin
Req: `{ bookingId, items: [{ itemId, tagNo, photoBase64 }] }` — 全itemにタグ+写真必須
処理: 写真をStorageへ→各item `stored`→最初のcheckinで `storage_started_at=now()`, `return_due_at` 計算, booking `active`。
Res: `{ returnDueAt }`

### POST /api/v1/store/request-pickup-otp
Req: `{ bookingToken }`
処理: pickup OTP生成(10分有効)→booking.email へ送信。既存未使用OTPは失効。レート制限 3回/15分。
Res: `{ sentTo: "s***@g***.com" }` (マスク表示)

### POST /api/v1/store/checkout
Req: `{ bookingToken, pickupOtp, itemIds: [..], overtimeSettled?: boolean }`
検証: pickup_otps 有効期間内・未使用・ハッシュ一致。item が overdue の場合 `overtimeSettled: true`(店頭QR精算済のスタッフ確認)がなければ `OVERTIME_UNSETTLED` 409。
処理: 指定itemを `returned`(部分受け取り可)。全item返却済で booking `completed`。
Res: `{ returnedItemIds, bookingStatus }`

### GET /api/v1/store/items?status=stored,overdue
自店舗の保管中一覧。Res: `[{ bookingNo, tagNo, size, returnDueAt, status, overtimeFeeVnd }]`

## 管理API(要 admin ロール)

### GET /api/v1/admin/dashboard?from&to
`{ totalBookings, activeItems, revenueVnd, completed, noShows, byStore: [...] }`

### GET /api/v1/admin/bookings?query&status&storeId&page
予約検索(booking_no/email/phone 部分一致)

### POST /api/v1/admin/bookings/:id/cancel
手動キャンセル+返金額登録。Req: `{ refundAmountVnd, reason }`

### CRUD /api/v1/admin/partners
紹介パートナー管理(hotel/bus_tour)。`GET /admin/partners/:id/pop?format=pdf` でQR付き案内POP生成。店舗ポスターは `GET /admin/stores/:id/poster?format=pdf`

### GET/PATCH /api/v1/admin/inquiries
問い合わせ一覧・状態更新(open/closed)・対応メモ

### CRUD /api/v1/admin/insurance-addons
追加補償オプションマスタ管理

### GET /api/v1/admin/daily?from&to&storeId
店舗×日別の日次レポート。
Res: `[{ date, storeId, storedItems, bySize: {S,M,L}, returnedItems, cancelledNoShow, cancelledByUser, overdueItems, revenueVnd }]`。`?format=csv` 対応

### GET /api/v1/admin/settlement?month=YYYY-MM
店舗別精算: `[{ storeId, grossVnd, commission40Vnd, paymentFeeVnd, insuranceVnd, systemVnd, netVnd }]`(売上40%/3%/6%/5%で計算)。CSVは `?format=csv`

## Cron(Vercel Cron or Supabase pg_cron、15分間隔)

1. no-show: `paid` かつ `arrival_slot_start + 3h < now` → `cancelled`(reason=no_show, refund=total−20,000)+メール通知
2. overdue: `stored` かつ `return_due_at < now` → `overdue`、overtime_fee 再計算(上限240,000)。初回遷移時+24h時点でメール通知
3. abandoned: `overdue` かつ `return_due_at + 7d < now` → `abandoned` フラグ+管理者通知
4. レビュー依頼: `completed` かつ完了1時間経過・未送信 → レビュー依頼メール送信(送信済みフラグで1回限り)
