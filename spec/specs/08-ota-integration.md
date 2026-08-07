# 08. OTA連携(Trip.com / Klook / KKday)

段階的に対応する。**PoC実装はレベル1のみ。ただしDBスキーマはレベル2対応分を最初から入れる**(01-data-model参照: bookings.channel / external_ref / ota_vouchers / price_plans.channel_tier)。

## 現実の販売形態(2026時点の確認結果)

- Trip.com「Things to Do」・Klook・KKday は、荷物預かりを**アクティビティ商品(バウチャー/QR券)として掲載**するのが標準(＝下記レベル2)。Klookには "luggage storage" カテゴリが実在。
- **手数料は15〜35%**でサプライヤーごとに個別交渉。掲載自体は無料・成果報酬型。
- オンボーディングは**承認制(即時セルフ登録ではない)**。契約・審査に時間がかかる前提。
- サプライヤーAPI直結(レベル3)は高ボリューム向け。まずはバウチャー型(レベル2)で開始するのが現実的。

## 「今すぐ準備すべきこと」と「契約後に作ること」の切り分け(重要)

**いま準備する(安価・Phase2構築中に仕込む＝後の作り直しを防ぐガードレール)**
0. **チャネルのレジストリ化(任意サイト対応の要)**: OTA名をスキーマにハードコードしない。`sales_channels` レジストリ(01)で管理し、`bookings.channel`(粗カテゴリ)＋`bookings.channel_code`(具体名) で記録。`ota_vouchers.provider` も check を外し `sales_channels.code` の緩い参照に。→ **Trip.com以外(Agoda/GetYourGuide/その他)も行を1つ足すだけで対応**、マイグレーション不要。
1. **チャネル別価格**: `price_plans.channel_tier`('direct'/'ota') を先行予約済み(01)。料金計算関数は最初から `(size, plan_hours, channel_tier)` で引く。PoCは常に 'direct'。→ OTA価格を後から足しても料金ロジックを触らない。
2. **前払い/外部発生の予約**: 予約作成を「PSP決済」以外の経路でも `paid` にできるようにしておく(`bookings.payment_provider` に 'ota_voucher' を許容、PSP呼び出しをスキップして paid で作成できる分岐余地)。voucher償還はこの経路に載る。
3. スキーマは `ota_vouchers` / `sales_channels` / `bookings.channel_code` / `external_ref` が予約済み(01)。追加不要。

## 新しいOTA/類似サイトを追加する手順(将来・レベル2運用時)
1. `sales_channels` に1行(code/name/type='ota'/commission_rate/supports_voucher=true)を追加。
2. 必要なら `price_plans` に `channel_tier='ota'` 価格行を追加(手数料を吸収した売価)。
3. 償還フロー(レベル2本体)は全OTA共通の1実装を使う(provider はデータ)。**個社ごとのコード改修は不要**。
4. サプライヤーAPI直結が要るOTAのみ、レベル3で個別アダプタを足す(`lib/ota/<provider>.ts` の想定)。

**契約後に作る(レベル2本体・OTA条件が確定してから)**
- バウチャーのコード形式・インポート/検証、償還フロー、精算突合、キャンセル同期。下記「レベル2」の通り。
- 契約前に本体を作らない(手数料率・コード仕様・返金ポリシーがOTA依存で、先に作ると作り直しになる)。

## レベル1: 掲載+リンク送客(PoC)

- OTA・自社SEOページ・Googleビジネスプロフィールから予約ページへディープリンク
- `?ref=ota_trip` 等で流入記録(07-growth-channels の共通トラッキングを使用)
- 追加開発なし

## レベル2: バウチャー償還型(PoC後の第一拡張)

OTA側で「荷物預かり券(サイズ×時間)」を商品登録し、利用者はOTAで購入、バウチャーコードを店舗で償還する。

### 業務ルール

- OTA手数料は一般に15〜35%(個別交渉)。**直販価格のままでは 店舗40%+保険6%+OTA手数料で赤字になるため、OTA向け販売価格は直販と別建て**。→ `price_plans.channel_tier='ota'` の行を追加(スキーマは先行予約済み・01)
- キャンセル・返金はOTA側ポリシーに従う(自社返金処理は行わない。OTA通知で `cancelled` に同期)
- 超過課金はOTA経由で回収できないため、店頭QR精算のみ(既存の overtimeSettled フローを流用)

### システム要件

- バウチャー登録: 管理画面でOTA発行のコード帯をインポート(CSV)、または償還時にコード形式検証のみで受理(OTAごとに設定)
- 償還フロー: 店舗の預かるフローに「OTAバウチャー」タブを追加 → コード入力/QR読取 → 有効性検証 → その場で booking を生成(channel=ota_*, external_ref=バウチャーコード, 決済済み扱い)→ 以降は通常の checkin と同一
- 電話・メールは償還時に店頭で聞いて入力(pickup OTP送信に必要)。入力簡略化のためQRコード読み取り式の自己入力画面(店頭タブレットを利用者に向ける)を用意
- 償還済みコードの重複使用は拒否(unique制約)
- 精算: チャネル別内訳を精算レポートに追加(OTA分はOTAからの入金と突合するため grossを分離)

## レベル3: サプライヤーAPI連携(将来)

- Trip.com(Things to Do サプライヤー)、Klook/KKdayのマーチャントAPIで在庫・予約・償還を自動同期
- 必要になる追加設計: 容量ポイントのチャネル別割当(直販枠とOTA枠の分離)、OTA予約Webhook受信、償還結果の返送
- 本仕様では設計しない。レベル2の稼働実績を見て別途仕様化する

## 受け入れ基準(レベル2実装時)

- [ ] 同一バウチャーコードの二重償還が拒否される
- [ ] OTA経由bookingが精算レポートで直販と分離集計される
- [ ] OTA経由でも pickup OTP・写真・タグの安全要件(06)が同一に適用される
