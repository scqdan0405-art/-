# 06. セキュリティ仕様(最優先・全実装で厳守)

## OTP

- 6桁数字、`crypto.randomInt` で生成。**平文はDBに保存しない**(bcryptハッシュ、cost 10)
- drop-off OTP: 予約確定時に生成。利用者への提示は「予約完了レスポンス(初回のみ)」と「確認メール」のみ
- pickup OTP: 店舗の受取操作で都度生成、有効10分、使用は1回。発行時に同予約の未使用pickup OTPを失効
- 照合失敗: booking単位で `otp_fail_count++`。5回で `otp_locked_until = now()+15min`。ロック中は照合APIが423。解除は時間経過 or 管理者操作
- レート制限: verify系 10req/min/IP、resend/request-pickup-otp 3req/15min/booking(Upstash Ratelimit または簡易DB実装)

## QRコード

- ペイロード: `https://<domain>/b/<bookingToken>` のみ。**OTP・個人情報を含めない**
- bookingToken は uuid v4。予約照会はこのトークンのみで可(URLを知る人=予約者とみなすが、OTPがなければ荷物は動かせない)

## 認可マトリクス

| 操作 | guest(token) | staff | admin |
|---|---|---|---|
| 予約作成・自予約照会・再送・キャンセル | ✅ | — | ✅ |
| verify-dropoff / checkin / checkout | — | ✅ 自店舗のみ | — |
| 他店舗の予約操作 | — | ❌(404を返す) | — |
| 管理API | — | — | ✅ |

- staff の store_id と booking の store_id 不一致は **403ではなく404**(他店舗の予約の存在を漏らさない)
- すべての store/admin API で監査ログ必須(actor_id, action, booking_id, detail)

## データ保護

- service role key はサーバーのみ。`NEXT_PUBLIC_` に秘密を置かない
- RLS: 全テーブル有効化し、anonロールは全拒否(サーバー経由のみ)。defense in depth
- カード情報は保存しない(PSPトークンのみ)。モックプロバイダでもカード番号をログ・DBに書かない
- 写真URL: Supabase Storage 非公開バケット+署名付きURL(有効1時間)
- メール・電話は管理画面でもマスク表示(フル表示は詳細ドロワーのみ)
- ログに PII(メール・電話・OTP)を出力しない
- **保持期間(PDPD準拠)**: 荷物写真は完了(returned/disposed)後 **90日** で削除。予約・個人情報は **1年** で削除または匿名化。監査ログは PoC期間+1年。cron で自動削除。削除期間は将来 fee_settings 同様に設定化してよい。
- **OTP配送の代替(PoC)**: pickup OTP はメールのみ。不達・受信不可時は運営が本人確認(予約番号+登録メール/電話の一致)して手動対応。SMS/Zalo は将来。

## 入力検証

- 全APIで zod スキーマ検証。電話は E.164 正規化(libphonenumber-js)
- photoBase64 は 5MB上限・jpeg/png のみ・マジックバイト検証
- idempotency: `POST /bookings` は `Idempotency-Key` ヘッダ対応(同一キーは同一レスポンス)
