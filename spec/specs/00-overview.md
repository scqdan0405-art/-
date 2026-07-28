# 00. 全体概要・アーキテクチャ・状態機械

## サービス概要

観光客がWebで予約・事前決済し、提携コンビニに荷物を預け、QR+OTPで受け取るサービス。
PoC範囲: 3店舗(ベンタイン/ブイビエン/タンソンニャット空港周辺)、利用者予約〜返却〜管理集計まで。

## アクターと画面

| アクター | 認証 | ルート |
|---|---|---|
| 利用者(旅行者) | アカウントレス(予約トークン+OTP) | `/[locale]/` 配下 |
| 店舗スタッフ | Supabase Auth(店舗アカウント)+スタッフ個人コード | `/store` 配下 |
| 運営管理者 | Supabase Auth(admin ロール) | `/admin` 配下 |

## アーキテクチャ

- Next.js App Router。ページ+Route Handlers(`/api/*`)
- Supabase PostgreSQL。DBアクセスはサーバー側のみ(service role key)。クライアントから直接Supabaseを叩かない(RLSはdefense in depth、06参照)
- 決済は `lib/payment/PaymentProvider` インターフェース経由。PoCは `MockProvider`(即時成功、遅延500ms、`4000`で終わるカード番号は失敗を返す)

## 用語

| 用語 | 意味 |
|---|---|
| booking | 予約(決済単位)。複数の item を持つ |
| item | 荷物1個。タグが付き、荷物単位でステータスを持つ |
| slot / capacity point | 店舗容量。S=1, M=2, L=3 ポイント |
| drop-off OTP | 預け入れ用OTP(予約確定時に発行) |
| pickup OTP | 返却用OTP(受取操作開始時に都度発行、10分有効) |
| overtime | プラン超過。10,000 VND/時、最大24時間で打ち止め |

## 状態機械(厳守)

### booking.status

```
pending_payment → paid → active → completed
pending_payment → payment_failed
paid → cancelled            (no-show自動 or 手動キャンセル)
active → completed          (全itemがreturned/disposedになった時)
```

### item.status

```
awaiting_dropoff → stored → returned
stored → overdue            (return_due_at 超過。cronで遷移)
overdue → returned          (超過精算完了後)
overdue → abandoned         (プラン終了後7日。PoCではフラグのみ、処分フローは対象外)
```

- 定義外遷移のリクエストは HTTP 409 + `{"error":"INVALID_TRANSITION"}`
- 状態遷移はすべて `audit_logs` に記録(誰が・いつ・何を・どの状態から/へ)

## 時間ルール

- プラン時間(3/6/12h)は **最初のitemの預け入れ完了時刻(stored遷移時)から起算**。`booking.storage_started_at` に記録し、`return_due_at = storage_started_at + plan_hours`
- 予約時は利用日+到着時間帯(1時間枠)を指定。時間帯終了+2時間まで預け入れ可。過ぎたら cron が `cancelled`(no-show)へ遷移し、返金額 = 支払額 − no-show手数料20,000 VND
- 超過: `now > return_due_at` のitemは `overdue`。超過料金 = ceil(超過時間) × 10,000 VND、上限24時間分(240,000 VND)。以降は加算しない

## 料金(price_plans テーブルで管理。ハードコード禁止)

| サイズ | 3h | 6h | 12h | ポイント |
|---|---|---|---|---|
| S (〜28in / **20kg以下**) | 50,000 | 70,000 | 100,000 | 1 |
| M (〜28in / **20kg超〜30kg以下**) | 70,000 | 100,000 | 150,000 | 2 |
| L (**29in以上 または 30kg超**) | 100,000 | 150,000 | 200,000 | 3 |

- サイズ境界は**非重複**(境界値20kg=S、30kg=M)。寸法が29in以上なら重量に関わらずL。寸法は目安、重量が主基準
- 最終判断は店舗スタッフ(預け入れ時のサイズ修正機能あり=12.10-B)

- 予約合計 = Σ(各itemのサイズ×プラン料金)+ 追加補償オプション料金(任意選択、insurance_addons マスタ)
- **予約時点の単価を booking_items にスナップショット保存**
- 税抜表示。VAT処理はPoC対象外(表示に「excl. tax」)
- 料金根拠メモ: 上表は原資料(改訂版・2026-07)の料金表で **確定**。S=50/70/100・M=70/100/150・L=100/150/200(千VND)。深夜・休日の追加料金なし、超過は自動延長10,000 VND/h。「価格は変更される場合あり」のため price_plans マスタで管理(ハードコード禁止)し、改定は新 valid_from 行の追加で行う

## 補償

- 基本補償は全荷物に自動付帯(1荷物500万VND/1予約1,000万VND上限)。追加保険料の利用者負担なし
- **追加補償(任意・有料)**: 将来対応(PoCスコープ外)。DBテーブル(insurance_addons)とAPI・予約項目(insurance_addon_vnd)はスキーマとして先行確保するが、**PoCではUIを出さない**(常に基本補償のみ・addon=0)。保険会社との条件確定後に有効化する

## PoC対象外(実装しない)

放置荷物の移送・処分フロー(abandonedフラグ止まり) / e-invoice / SMS送信(インターフェースだけ切り、メールのみ実装) / 出し入れ自由プラン(受け取りは予約時間内いつでも可、再預け入れが将来拡張) / 実PSP本番接続 / OTAレベル2以降(specs/08参照、スキーマのみ先行)
