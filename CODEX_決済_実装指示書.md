# Codex 指示書 — 決済（6方式・2C2P・Webhook・checkout UI）

作成: 2026-07-28 ／ 前提: T04〜T08 完了・決済抽象(`lib/payment`)とMockProviderは実装済み。仕様が正（specs 03/06/10）。AGENTS.mdのGit運用。

## 現状
- `lib/payment/`：`PaymentProvider` I/F（`createPaymentIntent`/`capture`/`refund`）＋MockProvider実装、`twoc2p-provider.ts` はスタブ。
- `PAYMENT_PROVIDER=mock|2c2p` 切替の枠あり。T06 予約作成が決済を呼ぶ。

## ゴール（PoCで作れる範囲＝いま実装）
**実キー不要の範囲を完成させる**。実際の2C2P本番接続はマーチャント契約・キー取得後（下記「事業側の前提」）。

### P1. インターフェース拡張（specs/10 に合わせる）
`PaymentProvider` に不足メソッドを追加：
- `createPayment(req) → { redirectUrl? , clientToken? , providerPaymentId, status }`（Hosted Payment Page 対応。既存 `createPaymentIntent` を包含/改名可）
- `verifyWebhook(payload, signature) → { providerPaymentId, status, amountVnd }`
- `getStatus(providerPaymentId) → status`
- `refund(providerPaymentId, amountVnd)`（既存）
- `PaymentIntentRequest` に **`method: 'card'|'apple_pay'|'google_pay'|'vietqr'|'momo'`** を追加（specs/03・13 の PaymentMethod）。

### P2. MockProvider を6方式対応に
- 6方式すべて受ける。**カード番号が `4000` で終わる場合は失敗**（specs/00）、その他は成功。方式ごとに成功/失敗を再現。
- 遅延500ms。`captured` で `paid` 合流。カード番号・トークンを**DB/ログに残さない**（specs/06）。
- 既存 `mock-provider.test.ts` を6方式・4000失敗ケースまで拡張。

### P3. 2C2P アダプタ（Hosted Payment Page スケルトン）
- `twoc2p-provider.ts` に Hosted Payment Page 方式を実装：`createPayment` は 2C2P の決済ページ `redirectUrl` を返す（署名生成）。`verifyWebhook` は署名検証→ステータス確定。`getStatus`/`refund` も実装。
- キーは env（`TWOC2P_MERCHANT_ID`/`TWOC2P_SECRET_KEY`/`TWOC2P_ENV=sandbox|production`）。**未設定時は明示エラー**（PoCは mock を使う）。実呼び出しは sandbox 前提でスタブ可（TODOで本番差し替え点を明記）。
- カード情報は自社非保持（2C2P トークン化）。

### P4. Webhook 受信エンドポイント
- `POST /api/v1/payments/webhook`：`verifyWebhook` で検証 → 対象 booking を `pending_payment→paid`（状態機械厳守・二重通知は冪等）→ drop-off OTP 発行＋確認メール（既存T06/T07の paid 合流に一本化）。
- 署名不正・不明refは 400/404。PII/カード情報をログに出さない。

### P5. checkout UI（specs/03 画面3）
- 決済方法6ボタン（クレジットカード(Visa/MC)・Apple Pay・Google Pay・VietQR・MoMo）を表示し `method` を送信。
- Hosted Payment Page 方式では `redirectUrl` に遷移 → 復帰後に予約完了 `/b/[token]`。Mock は即時結果。
- 二重送信防止（ボタンdisable＋Idempotency-Key、T06と整合）。

## やらないこと
- 2C2P 本番の実接続（契約・キー後）。VietQR/MoMo の自動返金（PoCは `refund_status=pending`＝運用手動・specs/12.9）。Direct API 方式（PoCはHosted）。

## 事業側の前提（システム対象外・specs/10 §事業側）
- 2C2P(M-Pay Trade)マーチャント契約・KYC、VND受取口座、Apple/Google Pay マーチャント登録、手数料率確定（→ 精算モデル05の決済3%を実レートに更新）。

## 受け入れ基準
- [ ] Mock で6方式が動き、`4000` 終わりカードは `payment_failed`＋容量解放（specs/03 E2E）。
- [ ] 決済成功→Webhook（or 即時）で `paid`＋drop-off OTP＋確認メール（二重通知でも1回）。
- [ ] `PAYMENT_PROVIDER=2c2p` で twoc2p アダプタ経路に切替（キー未設定は明示エラー）。
- [ ] カード番号・トークンが DB・ログに存在しない（grep で確認）。
- [ ] `npm run build && npm run test` 緑。AGENTS.md規約で push、コミットID・確認URL・結果を報告。

## Codex に貼るプロンプト
```
決済を specs 03/06/10・CODEX_決済_実装指示書.md に沿って実装。実キー不要の範囲(Mock6方式+2C2P Hosted PPスケルトン+Webhook+checkout UI)を完成させる。本番実接続は契約後なので作らない。
- PaymentProvider に method('card'|'apple_pay'|'google_pay'|'vietqr'|'momo') と createPayment/verifyWebhook/getStatus を追加
- MockProvider 6方式対応、カード末尾4000=失敗、カード情報は非保持。mock-provider.test を拡張
- twoc2p-provider に Hosted Payment Page(redirectUrl/署名/verifyWebhook/getStatus/refund)。キーはenv、未設定は明示エラー、実呼び出しはsandboxスタブ+TODO
- POST /api/v1/payments/webhook で検証→booking paid(冪等)→drop-off OTP+確認メール(T06/T07のpaid合流に一本化)
- checkout に6方式ボタン、Hostedはredirect、Mockは即時。二重送信防止
- PAYMENT_PROVIDER=mock|2c2p 切替。build&test緑→push→コミットID/確認URL/テスト結果を報告
- 4000失敗で payment_failed+容量解放、カード情報がDB/ログに無いことを確認
```
