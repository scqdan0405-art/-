# Codex 指示書 — OTA販売のためのガードレール（今Phase2で仕込む）

作成: 2026-07-28 ／ 目的: Trip.com/Klook/KKday での将来販売（specs/08 レベル2＝バウチャー償還）を、**後で作り直さずに**足せるよう、いまPhase2の料金・予約ロジック構築と同時に最小の受け皿だけ用意する。**本体（償還フロー）は作らない**（OTA契約後）。

## 背景（結論）
- OTAでの実販売はバウチャー型（レベル2）。手数料15〜35%・承認制・契約が先。→ 本体はいま作らない。
- ただし「チャネル別価格」と「前払い予約」の2点だけは、料金/予約の**中核ロジックに関わる**ため、後付けだと作り直しになる。いま受け皿を用意する。

## いま実装すること（4点のみ）

### G0. チャネルのレジストリ化（Trip.com以外の類似サイトも行追加で対応）
- **OTA名をコードにハードコードしない。** `sales_channels` テーブル（01）を追加：`code`(unique)/`name`/`channel_type`('direct'|'organic'|'ota'|'referral'|'store'|'sns')/`commission_rate`/`supports_voucher`/`is_active`。
- `bookings.channel` を**粗カテゴリのcheck**（'direct','organic','ota','referral','store','sns'）に変更し、**`channel_code text`（自由文字列）**を追加＝具体的な流入元（'trip','klook','agoda','google'…）。既存T02は追加/変更マイグレーションで対応。
- `ota_vouchers.provider` の**ハードコードcheckを削除**（`sales_channels.code` の緩い参照）。
- seed：sales_channels に direct/google/maps/trip/klook/kkday/hotel/bus_tour/store_poster/sns（trip/klook/kkday は type=ota・commission 0.25・supports_voucher=true）。
- 流入トラッキング：`?ref=<code>` の `<code>` を `sales_channels.code` に対応。未登録コードは粗カテゴリにフォールバックし、管理画面から登録可能に（ハードコードしない）。
- → **Agoda等の新規サイトは「sales_channels に1行」だけで対応**（マイグレーション不要）。

### G1. price_plans にチャネル次元を追加（追加マイグレーション）
- `price_plans` に **`channel_tier text not null default 'direct' check (channel_tier in ('direct','ota'))`** を追加（specs/01 更新済み）。
- ユニーク制約を **`unique(size, plan_hours, channel_tier, valid_from)`** に変更。
- 既存T02はマイグレーション適用済みのため、**新規の追加マイグレーション**で足す（既存 direct 行はそのまま・後方互換）。Drizzle: `schema.ts` に列追加 → `drizzle-kit generate` で追加マイグレーション。
- seed の既存9行は `channel_tier='direct'`。**OTA行は追加しない**（契約後）。

### G2. 料金計算をチャネル対応に（PoCは常に direct）
- `lib/pricing.ts` の価格取得を `price(size, planHours, channelTier='direct')` の引数に。呼び出し側（T05 quotes・T06 bookings）は既定 `'direct'`。
- specs/12.1 の期待値（P1〜P6）は `channelTier='direct'` で不変。テストはそのまま緑。
- これで将来 OTA価格を足しても**関数シグネチャと呼び出し経路を変えずに**対応可能。

### G3. 前払い/外部発生の予約経路を残す
- 予約作成を「PSP決済必須」に密結合しない。`bookings.payment_provider` に将来 **`'ota_voucher'`** を許容（現状 payment_provider に DB check は無いので値追加は自由）。
- T06の決済ステップを「provider に応じて分岐」できる形にしておく（PoCは `mock`/`2c2p` のみ実装。voucher 分岐は**枠だけ**＝TODOコメントで可）。決済成功時と同じ「paid＋drop-off OTP発行＋確認メール」に合流する構造にする。
- ※ここは分岐の**構造を用意するだけ**。voucher の実処理・償還UIは作らない。

## いま作らないこと（契約後・レベル2本体）
- バウチャーのコード形式・CSVインポート・有効性検証・二重償還拒否
- 店舗「OTAバウチャー」償還タブ、店頭自己入力画面
- OTA精算突合・キャンセル同期
- 容量のチャネル別割当（レベル3）

## 受け入れ基準（ガードレール完了）
- [ ] `price_plans.channel_tier` 追加マイグレーションが通り、`npx supabase db reset` 成功。既存 direct 9行が seed される。
- [ ] `lib/pricing.ts` が `channelTier` 引数対応（既定 direct）。specs/12.1 P1〜P6 テスト緑。
- [ ] T05/T06 が direct で従来どおり動作（見積・予約・容量・OTP・冪等性）。
- [ ] `npm run build && npm run test` 通過。AGENTS.md 規約で commit/push。

## 受け入れ基準（G0追加分）
- [ ] `sales_channels` 追加＋seed（10行前後）。`npx supabase db reset` 成功。
- [ ] `bookings.channel` は粗カテゴリcheck、`channel_code` 追加。`ota_vouchers.provider` の固定checkが無い。
- [ ] `?ref=agoda`（未登録でも）で予約でき、channel_code に記録される（新規サイトがコード改修なしで載る）。

## Codex に貼るプロンプト
```
specs/08・01（sales_channels/channel_code/price_plans.channel_tier 追記済み）・13（Channel粗カテゴリ+ChannelCode）と
CODEX_OTA準備_ガードレール指示書.md を読み、Phase2 と同時に OTAガードレール G0〜G3 だけ実装。OTA本体（償還フロー）は作らない。
- G0: sales_channels レジストリ追加(seed 10行)。bookings.channel を粗カテゴリ(direct/organic/ota/referral/store/sns)に、channel_code(自由文字列)追加。ota_vouchers.provider の固定checkは外す。?ref=<code> は sales_channels.code に対応・未登録はフォールバック。→ 任意OTAは行追加で対応。
- G1: price_plans に channel_tier('direct'/'ota',既定direct) 追加、unique を (size,plan_hours,channel_tier,valid_from)。seedは direct 9行。
- G2: lib/pricing を price(size,planHours,channelTier='direct')。specs/12.1 P1-P6 緑のまま。
- G3: 予約作成は payment_provider で決済分岐できる構造に。'ota_voucher'(将来)は枠だけTODO。paid合流は共通化。
- build&test通過→commit→git push origin master。完了後にコミットID・確認URL・テスト結果を報告。
```
