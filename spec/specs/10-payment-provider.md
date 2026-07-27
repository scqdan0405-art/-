# 10. 決済プロバイダ選定(確定)

## 決定

**本番PSP = 2C2P**(代替 = OnePay)。

外国人観光客のVisa/Mastercardを主軸に、Apple Pay・Google Pay・VietQR・MoMoまで、資料明記の6方式すべてを **1契約・1連携** で提供できるため。将来の決済方式追加を発生させないことを最優先に選定した。

## 選定理由

- 資料の対象は7か国の外国人観光客(米・豪など英語圏含む)。主決済は国際カードとApple/Google Pay。2C2Pはクロスボーダー決済に特化し、これらを標準提供する
- 同時にベトナム現地のMoMo・VietQR(NAPAS)も同一APIでカバー。現地客・現地決済も取りこぼさない
- Hosted Payment Page と Direct API の両方式を提供。PoCはHosted Payment Pageで最短実装、拡張時にDirect APIへ移行可能
- Vietnam法人(M-Pay Trade がライセンス提供元)経由で運用。東南アジア広域対応のため、将来の多都市・多国展開でも同一PSPを継続できる

## 候補比較

| PSP | Visa/MC | Apple/Google Pay | VietQR | MoMo | 外国人カード適性 | 備考 |
|---|---|---|---|---|---|---|
| **2C2P(採用)** | ◎ | ◎ | ○ | ◎ | ◎ クロスボーダー特化 | Hosted+Direct、東南アジア広域 |
| OnePay(代替) | ◎ | △(要確認) | ○ | ○ | ○ | ベトナム老舗・国内寄り、銀行連携強い |
| Stripe | ◎ | ◎ | ✕ | ✕ | ◎ | VietQR/MoMo非対応のため単独不可 |

## 実装要件

- `lib/payment/PaymentProvider` インターフェースを実装する `twoc2p.ts` を用意
- 必須メソッド: `createPayment(bookingDraft) → {redirectUrl | clientToken}`、`verifyWebhook(payload)`、`getStatus(ref)`、`refund(ref, amountVnd)`
- Webhook で決済確定を受け、booking を `paid` に遷移(02-api の POST /bookings は Hosted Payment Page 併用時、決済確定Webhookで確定する二段構成でも可)
- 通貨はVND。カード情報は自社非保持(2C2P側トークン化。06準拠)
- `PAYMENT_PROVIDER=mock|2c2p` で切替。PoCは mock、本番接続時に 2c2p

## 事業側で必要な準備(システム対象外)

- 2C2P(M-Pay Trade)とのマーチャント契約・KYC
- Vietnam事業体・決済受取口座(VND)
- Apple Pay / Google Pay のマーチャント登録(2C2P経由の手続き)
- 手数料率の確定 → 精算モデル(05)の「決済手数料 約3%」を実レートで更新

## 出典(2026年7月時点の調査)

- 2C2P Vietnam(Visa/MC・Apple Pay・Google Pay・MoMo・VietQR対応、Hosted/Direct、M-Pay Tradeがライセンス提供元)
- OnePay(Visa/MC/JCB/Amex/UnionPay・MoMo・QR。国内寄り)

情報は変動するため、契約前に各社と最新の対応方式・手数料を要確認。
