# 14. 通知・メールテンプレート（一覧・タイミング・設定化）

目的：顧客への連絡漏れとクレームを防ぐ。**全通知を一覧化**し、文面は**テンプレートマスタ（`notification_templates`）で管理**して、コードを触らず管理画面から編集できるようにする。

PoCの配信チャネルは **メール**（利用者）＋**画面/メール**（運営）。SMS/Zalo/WhatsApp は将来（キーだけ用意）。

## 14.1 通知一覧（キー・トリガー・宛先・変数）

| key | トリガー / タイミング | 宛先 | 主な差し込み変数 |
|---|---|---|---|
| `booking_confirmation` | 決済成功で予約確定 | 利用者 | bookingNo, storeName, storeArea, storeAddress, planLabel, itemsSummary, totalVnd, **dropoffOtp**, bookingUrl, arrivalSlot, notes |
| `pickup_otp` | 店舗が受取操作でOTP発行 | 利用者 | bookingNo, **pickupOtp**（10分有効）, storeName |
| `booking_cancelled_user` | 利用者が預入前にキャンセル | 利用者 | bookingNo, refundVnd, cancellationFeeVnd |
| `booking_cancelled_noshow` | cron：no-show自動キャンセル | 利用者 | bookingNo, refundVnd |
| `prohibited_item_refused` | 店舗が禁止物で受入拒否 | 利用者 | bookingNo, refundVnd |
| `overtime_started` | cron：超過発生（overdue遷移） | 利用者 | bookingNo, returnDueAt, overtimeHourlyVnd |
| `overtime_24h` | cron：超過24時間後 | 利用者 | bookingNo, overtimeFeeVnd, dailyFeeInfo |
| `overtime_72h` | cron：超過72時間後 | 利用者 | bookingNo, relocateAfterDays（移送予告） |
| `review_request` | cron：全item返却完了の1時間後 | 利用者 | bookingNo, storeName, reviewUrl, shareUrl |
| `inquiry_ack`（任意） | 問い合わせ受信 | 利用者 | inquiryId |
| `admin_abandoned` | cron：abandoned（プラン終了+7日） | 運営 | bookingNo, storeName, tagNo |
| `admin_inquiry` | 問い合わせ受信 | 運営 | inquiry本文, email, bookingNo? |

- **多言語**：利用者向けは予約の `locale` で送信。テンプレは 7ロケール（en/vi/ja/ko/zh-CN/zh-TW/hi）。未整備ロケールは **en にフォールバック**。運営向けは ja/en。
- 送信は全て `lib/mail/` 経由。送信結果（成功/失敗）を記録し、失敗はリトライ＋運営通知。

## 14.2 テンプレートの保存と描画

```sql
create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,                 -- 14.1 の key
  locale text not null,              -- en/vi/ja/ko/zh-CN/zh-TW/hi
  channel text not null default 'email' check (channel in ('email','sms','inapp')),
  subject text,                      -- メール件名（inapp は null 可）
  body text not null,                -- 本文（下記プレースホルダ可）
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(key, locale, channel)
);
```

- **プレースホルダ**：本文/件名に `{{変数名}}` を書くと差し込み。例 `{{bookingNo}}`, `{{dropoffOtp}}`, `{{returnDueAt}}`（表示は `Asia/Ho_Chi_Minh`）, `{{totalVnd}}`（3桁区切り+" VND"）。
- 未知の変数、または値なしは空文字に（送信は止めない）。必須変数（OTP等）が空なら送信せずエラーとして運営通知。
- 描画は純粋関数 `renderTemplate(template, vars) -> {subject, body}`（ユニットテスト対象。差し込み・エスケープ・フォールバックを検証）。

## 14.3 文面の取り込み（人が書く → システムへ）

1. 人が **`KONCOCHII_通知テンプレート.xlsx`**（別途提供のワークシート）に各通知×ロケールの件名・本文を記入。
2. その内容を `notification_templates` へ取り込む：
   - PoC初期：xlsx → CSV → seed スクリプトで投入（`npm run seed:templates`）。または管理画面のインポート機能。
   - 以降：**管理画面から直接編集**（14.4）。
3. ワークシートには初期ドラフト（ja/en/vi）を入れてある。人が確認・修正し、ko/zh-CN/zh-TW/hi を追記する。

## 14.4 管理画面（`/admin/templates`）

- 通知キー×ロケールの一覧、件名・本文の編集、プレビュー（サンプル変数で描画確認）、有効/無効。
- 使用可能な変数の一覧を各テンプレの編集画面に表示。
- 変更は即時反映（次回送信から）。更新履歴（updated_at・変更者）を残す。

## 受け入れ基準

- [ ] 14.1 の全通知が、正しいトリガーで1回だけ送られる（重複送信なし。cron系は送信済みフラグ）
- [ ] `renderTemplate` が差し込み・未定義変数・ロケールフォールバックを仕様どおり処理（ユニットテスト）
- [ ] テンプレを管理画面で変更すると次回送信に反映され、コード変更不要
- [ ] 必須変数（OTP等）欠落時は送信せず運営通知
- [ ] 送信失敗が記録・リトライされる
