# 13. API契約（単一ソースの型・確定）

目的：**フロントとバックエンドの「入出力の形ズレ」バグを構造的に防ぐ**。
そのために、リクエスト/レスポンスの形を **zodスキーマで1か所に定義**し、そこから TypeScript型（`z.infer`）とサーバー側バリデーションの両方を導出する。フロントは同じ型/スキーマを import する。

## 大原則

1. **Single Source of Truth**：契約は `app/src/contracts/` に置く zod スキーマのみ。型を手書きで別定義しない（必ず `z.infer`）。
2. サーバーの Route Handler は、入口で必ず対応スキーマ `.parse()`（失敗は 400 `VALIDATION_ERROR`）。出口も対応スキーマで型付け。
3. フロントの API 呼び出しは、`app/src/contracts` の型を使う型付きクライアント（`lib/api-client.ts`）経由のみ。`any` で fetch しない。
4. `contracts/` は **サーバー専用依存を含めない**（純粋 zod のみ）。クライアントから import 可能に保つ。
5. 命名は **camelCase**。金額は VND 整数。時刻は **ISO8601 UTC 文字列**（例 `2026-07-27T02:15:00Z`）で送受信し、表示側で `Asia/Ho_Chi_Minh` に変換。

## 共通（`contracts/common.ts`）

```ts
import { z } from "zod";

export const Size = z.enum(["S", "M", "L"]);
export const PlanHours = z.union([z.literal(3), z.literal(6), z.literal(12)]);
export const Locale = z.enum(["en", "vi", "ja", "ko", "zh-CN", "zh-TW", "hi"]);
export const Channel = z.enum([
  "direct","google","maps","ota_trip","ota_klook","ota_kkday",
  "hotel","bus_tour","store_poster","sns",
]);
export const PaymentMethod = z.enum(["card","apple_pay","google_pay","vietqr","momo"]);

export const BookingStatus = z.enum([
  "pending_payment","payment_failed","paid","active","completed","cancelled",
]);
export const ItemStatus = z.enum([
  "awaiting_dropoff","stored","overdue","returned","abandoned",
]);

// 金額：VND 非負整数
export const Vnd = z.number().int().nonnegative();
// 時刻：ISO8601 UTC
export const IsoUtc = z.string().datetime(); // 例 "2026-07-27T02:15:00Z"

// 予約番号 / トークン / OTP
export const BookingNo = z.string().regex(/^KC-\d{6}$/);
export const BookingToken = z.string().uuid();
export const Otp = z.string().regex(/^\d{6}$/);
export const Phone = z.string().regex(/^\+[1-9]\d{6,14}$/); // E.164

// エラーコード（HTTPと対応）
export const ErrorCode = z.enum([
  "VALIDATION_ERROR",     // 400
  "NOT_FOUND",            // 404
  "INVALID_TRANSITION",   // 409
  "CAPACITY_FULL",        // 409
  "OTP_INVALID",          // 401
  "OTP_LOCKED",           // 423
  "PAYMENT_FAILED",       // 402
  "OVERTIME_UNSETTLED",   // 409
  "RATE_LIMITED",         // 429
  "FORBIDDEN",            // 403
]);
export const ApiError = z.object({
  error: ErrorCode,
  message: z.string(),           // 英語（人間可読）
  details: z.unknown().optional(),
});
```

エラーは全エンドポイント共通でこの `ApiError` 形。HTTPステータスは上のコメント対応を厳守。成功レスポンスは各エンドポイントのスキーマそのまま（エンベロープで包まない）。

## 利用者向け（`contracts/user.ts`）

```ts
// GET /api/v1/stores?date=YYYY-MM-DD
export const StoresQuery = z.object({ date: z.string().date() });
export const StoreSummary = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.record(Locale, z.string()),   // ロケール別名称
  area: z.string(),
  lat: z.number().nullable(), lng: z.number().nullable(),
  openTime: z.string(), closeTime: z.string(),
  capacityPoints: z.number().int(),
  availablePoints: z.number().int(),
});
export const StoresResponse = z.array(StoreSummary);

// POST /api/v1/quotes
export const QuoteRequest = z.object({
  storeId: z.string().uuid(),
  visitDate: z.string().date(),
  planHours: PlanHours,
  items: z.array(z.object({ size: Size })).min(1).max(5),
  insuranceAddonId: z.string().uuid().optional(),
});
export const QuoteResponse = z.object({
  itemsTotalVnd: Vnd,
  insuranceAddonVnd: Vnd,
  totalVnd: Vnd,
  lines: z.array(z.object({ size: Size, unitPriceVnd: Vnd })),
  expiresAt: IsoUtc,
});

// POST /api/v1/bookings  （ヘッダ Idempotency-Key 必須）
export const CreateBookingRequest = z.object({
  storeId: z.string().uuid(),
  visitDate: z.string().date(),
  arrivalSlotStart: IsoUtc,
  planHours: PlanHours,
  items: z.array(z.object({ size: Size })).min(1).max(5),
  insuranceAddonId: z.string().uuid().optional(),
  email: z.string().email(),
  phone: Phone,
  locale: Locale,
  channel: Channel.optional(),
  referralCode: z.string().optional(),
  disclaimerAccepted: z.literal(true),
  prohibitedItemsAcknowledged: z.literal(true),
  payment: z.object({ method: PaymentMethod, token: z.string() }),
});
export const CreateBookingResponse = z.object({
  bookingNo: BookingNo,
  bookingToken: BookingToken,
  dropoffOtp: Otp,     // 平文はこのレスポンスと確認メールのみ
});

// GET /api/v1/bookings/:token  （drop-off OTPは含めない。有効なpickup OTPのみ例外＝06のOTP不達対策）
export const ItemView = z.object({
  id: z.string().uuid(),
  size: Size,
  status: ItemStatus,
  tagNo: z.string().nullable(),
  returnDueAt: IsoUtc.nullable(),
  overtimeFeeVnd: Vnd,
});
export const BookingView = z.object({
  bookingNo: BookingNo,
  status: BookingStatus,
  storeArea: z.string(),
  planHours: PlanHours,
  totalVnd: Vnd,
  items: z.array(ItemView),
  returnDueAt: IsoUtc.nullable(),
  activePickupOtp: z.object({ otp: Otp, expiresAt: IsoUtc }).nullable(), // 有効期間内(10分)・未使用の時のみ非null
});

// PATCH /api/v1/bookings/:token/email  （預け入れ前のみ・06のOTP不達対策③）
export const UpdateEmailRequest = z.object({ email: z.string().email() });
export const UpdateEmailResponse = z.object({ email: z.string().email() }); // 全item awaiting_dropoff 以外は 409 INVALID_TRANSITION
```

## 店舗向け（`contracts/store.ts`）

ヘッダ：`x-staff-code`（必須）。認可NGは 403 `FORBIDDEN`。他店舗予約は 404（存在秘匿・06準拠）。

```ts
export const VerifyDropoffRequest = z.object({ bookingToken: BookingToken, otp: Otp });
export const VerifyDropoffResponse = z.object({
  bookingNo: BookingNo,
  planHours: PlanHours,
  items: z.array(z.object({ id: z.string().uuid(), size: Size })),
});

export const CheckinRequest = z.object({
  bookingId: z.string().uuid(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    tagNo: z.string().min(1),
    photoBase64: z.string(),          // jpeg/png・5MB上限（サーバーで検証）
    sizeOverride: Size.optional(),    // 実物サイズ修正(12.10-B)
  })).min(1),
});
export const CheckinResponse = z.object({
  returnDueAt: IsoUtc,
  sizeAdjustmentVnd: Vnd.or(z.number().int()), // 差額(負=返金相当)。合計
});

export const RequestPickupOtpRequest = z.object({ bookingToken: BookingToken });
export const RequestPickupOtpResponse = z.object({ sentTo: z.string() }); // マスク済み宛先

export const CheckoutRequest = z.object({
  bookingToken: BookingToken,
  pickupOtp: Otp,
  itemIds: z.array(z.string().uuid()).min(1),  // 部分受け取り可
  overtimeSettled: z.boolean().optional(),
});
export const CheckoutResponse = z.object({
  returnedItemIds: z.array(z.string().uuid()),
  bookingStatus: BookingStatus,
});

// GET /api/v1/store/items?status=stored,overdue
export const StoreItemsResponse = z.array(z.object({
  bookingNo: BookingNo, tagNo: z.string().nullable(), size: Size,
  returnDueAt: IsoUtc.nullable(), status: ItemStatus, overtimeFeeVnd: Vnd,
}));
```

## 管理向け（`contracts/admin.ts`）

要 admin ロール。主要のみ（残りも同じ流儀で定義）。

```ts
export const DashboardResponse = z.object({
  totalBookings: z.number().int(), activeItems: z.number().int(),
  revenueVnd: Vnd, completed: z.number().int(), noShows: z.number().int(),
  byStore: z.array(z.object({ storeId: z.string().uuid(), bookings: z.number().int(), revenueVnd: Vnd })),
});
export const SettlementRow = z.object({
  storeId: z.string().uuid(), grossVnd: Vnd,
  commission40Vnd: Vnd, paymentFeeVnd: Vnd, insuranceVnd: Vnd, systemVnd: Vnd, netVnd: Vnd,
});
export const SettlementResponse = z.array(SettlementRow);
```

## 実装ルール（Codex向け）

- 各 Route Handler：`const body = XxxRequest.parse(await req.json())`（または `safeParse`＋400）。返却は `XxxResponse.parse(payload)` で型保証してから `NextResponse.json()`。
- 型は必ず `export type CreateBookingRequest = z.infer<typeof CreateBookingRequest>` の形で導出し、フロント/バックで共有。
- フロントの型付きクライアント `lib/api-client.ts`：エンドポイントごとに Request を受け Response を返す関数。fetch の戻りを対応スキーマで `parse`（実行時にも契約を検証＝ズレを即検知）。
- 追加/変更時は**必ず `contracts/` を先に直す**。ここを直さずに Route やフロントだけ変更するのは禁止。
- 任意で `@asteasolutions/zod-to-openapi` で OpenAPI を生成してよい（`contracts/` から自動生成、手書きしない）。

## 受け入れ基準

- [ ] すべての API 入力が対応 zod スキーマで検証され、不正入力は 400 `VALIDATION_ERROR`
- [ ] フロントは `contracts` の型のみ使用（`any` fetch なし）。型不一致はビルドで落ちる
- [ ] レスポンスが `contracts` スキーマに一致（レスポンス parse のテスト）
- [ ] エラー形が全エンドポイントで `ApiError`＋規定HTTPステータス
- [ ] 金額=VND整数、時刻=ISO8601 UTC の一貫性（境界テスト）
