# Codex 指示書 — OTA販売のためのガードレール（今Phase2で仕込む）

作成: 2026-07-28 ／ 目的: Trip.com/Klook/KKday での将来販売（specs/08 レベル2＝バウチャー償還）を、**後で作り直さずに**足せるよう、いまPhase2の料金・予約ロジック構築と同時に最小の受け皿だけ用意する。**本体（償還フロー）は作らない**（OTA契約後）。

## 背景（結論）
- OTAでの実販売はバウチャー型（レベル2）。手数料15〜35%・承認制・契約が先。→ 本体はいま作らない。
- ただし「チャネル別価格」と「前払い予約」の2点だけは、料金/予約の**中核ロジックに関わる**ため、後付けだと作り直しになる。いま受け皿を用意する。

## いま実装すること（3点のみ）

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

## Codex に貼るプロンプト
```
specs/08 と 01（price_plans.channel_tier 追記済み）、CODEX_OTA準備_ガードレール指示書.md を読み、
Phase2 と同時に OTAガードレール G1〜G3 だけ実装。OTA本体（償還フロー）は作らない。
- price_plans に channel_tier('direct'/'ota', 既定direct) を追加マイグレーションで足し、unique を (size,plan_hours,channel_tier,valid_from) に。seedは direct 9行のまま。
- lib/pricing を price(size,planHours,channelTier='direct') に。specs/12.1のP1-P6テストは緑のまま。
- 予約作成は payment_provider で決済を分岐できる構造にし、'ota_voucher'(将来)は枠だけTODO。paid合流は共通化。
- build&test通過→commit→git push origin master。完了後にコミットID・確認URL・テスト結果を報告。
```
