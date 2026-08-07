# Codex 次アクション — スキーマ差分反映 → Phase 2（予約フロー）＋ OTAガードレール

作成: 2026-07-28 ／ これが**次にCodexへ渡す指示**。仕様が正（specs/）。AGENTS.md の Git運用（master全体push・force-push禁止・push後に報告）。

## 現在地
- T02（DBスキーマ・Drizzle）完了＆push済み。Phase3 T08（店舗Auth）が先行実装済み。
- **Phase 2（予約フロー T04〜T07）が未実装**。ここを最優先で埋める。
- T02以降に仕様を更新済み（下記 Step A の差分）。**まず差分を追加マイグレーションで反映**してから Phase2 に入る。

## 実施順序（この順で）

### Step A. スキーマ差分の追加マイグレーション（T02-delta）
T02は適用済みのため、**新規の追加マイグレーション**で以下を反映（既存データ後方互換・破壊しない）。詳細は `specs/01`・`CODEX_OTA準備_ガードレール指示書.md`（G0/G1）。

1. **sales_channels（新規テーブル）**＋seed10行：`code`(unique)/`name`/`channel_type`('direct','organic','ota','referral','store','sns')/`commission_rate`/`supports_voucher`/`is_active`。seed=direct,google,maps,trip,klook,kkday,hotel,bus_tour,store_poster,sns（trip/klook/kkday は type=ota・commission 0.25・supports_voucher=true）。
2. **bookings.channel**：check を粗カテゴリ `('direct','organic','ota','referral','store','sns')` に変更。**`channel_code text`（NULL可・自由文字列）を追加**。
3. **ota_vouchers.provider**：ハードコード check を**削除**（`sales_channels.code` の緩い参照）。
4. **price_plans**：**`channel_tier text not null default 'direct' check (channel_tier in ('direct','ota'))` を追加**。unique を `(size, plan_hours, channel_tier, valid_from)` に。seed 既存9行は `channel_tier='direct'`（OTA行は追加しない）。
5. `npx supabase db reset` が通ること（seed込み）。

### Step B. Phase 2 本体（T04〜T07）
`CODEX_Phase2_予約フロー_指示書.md` に従う。要点：
- 金額/OTP/状態遷移/容量はサーバーのみ。契約 `src/contracts`（specs/13）で入口・出口 parse。
- `lib/pricing`・`overtime`・`capacity`・`state-machine` を純粋関数化し、**specs/12 の表（P1-P6, O1-O10, D1-D4, C1-C5, N1-N2, I1-I2）をVitest**。
- **T06**：容量ロック直列化（SELECT FOR UPDATE）・決済(Mock)・drop-off OTP（bcrypt・平文非保存）・冪等性（Idempotency-Key）・**同時実行レースとC4夜またぎ**を必ずテスト。
- **T07/T07b**：QRは bookingToken のみ（OTP非含有）、`activePickupOtp` 表示、`PATCH /bookings/:token/email`（預入前のみ・新旧両宛 `email_changed`）、禁止物＋所有物宣言（電子機器・記録媒体も禁止物＝12.10-C-1）。

### Step C. OTAガードレール G2/G3（Phase2 に織り込む）
`CODEX_OTA準備_ガードレール指示書.md`（G0/G1 は Step A で完了）。残り：
- **G2**：`lib/pricing` を `price(size, planHours, channelTier='direct')` シグネチャに。specs/12.1 P1-P6 は direct で緑のまま。
- **G3**：予約作成を `payment_provider` で決済分岐できる構造に。将来の `'ota_voucher'` は**枠だけTODO**（PSPスキップで paid 合流）。本体の償還フローは作らない。
- 流入トラッキング：`?ref=<code>` を `sales_channels.code` に対応。未登録コードはフォールバックし記録（`channel_code`）。→ 任意OTAが行追加だけで載る。

## やらないこと（今回のスコープ外）
- OTAバウチャー償還フロー本体（レベル2）、OTA精算突合、サプライヤーAPI（レベル3）。
- Phase3 T09以降（Step B完了後に別途）。

## 完了報告（Step A〜C 終了時）
- [ ] `npx supabase db reset` 成功（sales_channels/channel_tier 反映・seed）。
- [ ] 予約フロー E2E：満杯不可・同時競合・決済失敗で解放・QRはtokenのみ・キャンセルは awaiting_dropoff のみ・見積/no-show が specs/12 と一致（specs/15 E1〜E4・E12・E14c）。
- [ ] `?ref=agoda`（未登録）でも予約でき channel_code に記録。
- [ ] `npm run build && npm run test` 緑。
- [ ] AGENTS.md 規約で `git push origin master` → コミットID・push先・確認URL・テスト結果を報告。

## Codex に貼るプロンプト（そのまま貼る）
```
次を順に実施してください。仕様が正（specs/）。AGENTS.mdのGit運用に従い、完了後にコミットID・確認URL・テスト結果を報告。

参照: CODEX_次アクション_Phase2一式.md / CODEX_Phase2_予約フロー_指示書.md / CODEX_OTA準備_ガードレール指示書.md / specs 01,02,03,06,08,12,13,14,16

Step A（追加マイグレーション・T02は適用済みなので差分のみ）:
- sales_channels 新規＋seed10行（trip/klook/kkday=type ota,commission0.25,supports_voucher true 等）
- bookings.channel を粗カテゴリ(direct/organic/ota/referral/store/sns)に、channel_code(text,NULL可)追加
- ota_vouchers.provider の固定checkを削除
- price_plans に channel_tier(direct/ota,既定direct)追加、unique を (size,plan_hours,channel_tier,valid_from)。seedはdirect9行
- npx supabase db reset が通ること

Step B（Phase2 T04〜T07・CODEX_Phase2指示書どおり）:
- GET /stores, POST /quotes(営業時間内枠), POST /bookings(容量ロック直列化/決済Mock/drop-off OTP bcrypt平文非保存/冪等性/同時実行レース/C4夜またぎ), /b/[token](QRはtokenのみ/OTP初回表示/再送/キャンセル)
- lib/pricing・overtime・capacity・state-machine を純粋関数化し specs/12 の表をVitest
- T07b: activePickupOtp表示 / PATCH email(預入前のみ・新旧両宛email_changed) / 禁止物+所有物宣言(電子機器も禁止物)

Step C（OTAガードレール残り）:
- G2: pricingを price(size,planHours,channelTier='direct') に（P1-P6緑のまま）
- G3: 予約作成をpayment_providerで決済分岐できる構造に、'ota_voucher'は枠だけTODO（paid合流共通化）
- ?ref=<code> は sales_channels.code に対応・未登録はフォールバックしてchannel_code記録

各タスクで npm run build && npm run test を通してコミット。Step Cまで終えたら受け入れ基準の結果を報告して止まる。
OTAバウチャー償還本体・レベル3・Phase3 T09以降は作らない。
```
