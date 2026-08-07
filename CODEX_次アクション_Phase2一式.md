# Codex 次アクション — チャネル/OTA汎用化の適用 → Phase 3 残り（T09〜T11）

作成: 2026-07-28 ／ 更新: 実装状況に合わせて改訂。仕様が正（specs/）。AGENTS.md の Git運用（master全体push・force-push禁止・push後に報告）。

## 現在地（確認済み）
- **完了**: T02（DB/Drizzle）、T04-05（店舗検索・見積）、T06（予約作成）、T07（予約詳細・QR）、T08（店舗Auth・ホーム）。ドメインテスト（pricing/overtime/capacity/capacity-race/idempotency/otp/state-machine）実装済み。
- **未適用**: 直近の仕様更新（チャネル/OTAのレジストリ化・price_plans.channel_tier）が**まだ app に入っていない**（`contracts/common.ts` と `schema.ts` は旧 channel 列挙のまま）。
- **未実装**: Phase 3 の残り **T09（預かる/checkin）・T10（返す/checkout）・T11（cron 3種）**。

## 自己検証・自己修正の原則（重要）
- 各ステップの後に必ず **`npx supabase db reset && npm run build && npm run test`**（あればE2E）を実行。
- **自分の変更で壊れた箇所（既存T04-T08含む）は自分で直す。** 人間の確認を待たない。
- どうしても解決できない矛盾（仕様同士の衝突等）に限り、`spec/TASKS.md` の Open Questions に記録して報告。

## Step A. チャネル/OTA汎用化を app に適用（既存コードのリファクタ＋追加マイグレーション）
根拠: `specs/01`・`specs/08`・`specs/13`・`CODEX_OTA準備_ガードレール指示書.md`（G0/G1）。

1. **sales_channels（新規テーブル）＋seed10行**（direct/google/maps/trip/klook/kkday/hotel/bus_tour/store_poster/sns。trip/klook/kkday は type=ota・commission 0.25・supports_voucher=true）。
2. **bookings.channel** を粗カテゴリ check `('direct','organic','ota','referral','store','sns')` に変更し、**`channel_code text`（NULL可）を追加**。既存 `bookings/route.ts` の `channel` 設定を粗カテゴリ＋channel_code に更新。
3. **ota_vouchers.provider** の固定 check を削除（`sales_channels.code` 緩い参照）。
4. **price_plans** に **`channel_tier text not null default 'direct' check(...'direct','ota')`** を追加、unique を `(size,plan_hours,channel_tier,valid_from)` に。seed 既存9行は direct。
5. **`contracts/common.ts` の `Channel`** を粗カテゴリ enum に置換し **`ChannelCode`（自由文字列）を追加**（specs/13）。`user.ts` の CreateBooking に `channelCode` 追加。
6. **`lib/pricing`** を `price(size, planHours, channelTier='direct')` に（G2）。**specs/12.1 P1-P6 テストは direct で緑のまま**（必要なら軽微修正）。
7. **流入トラッキング**: `?ref=<code>` を `sales_channels.code` に対応。未登録コードは粗カテゴリにフォールバックして `channel_code` に記録（G0）。→ 任意OTA（Agoda等）が行追加だけで載る。
8. **G3（枠だけ）**: 予約作成を `payment_provider` で決済分岐できる構造に。将来の `'ota_voucher'` は TODO コメント（PSPスキップで paid 合流）。本体は作らない。
- **完了条件**: `db reset`＋`build`＋`test` 緑。`?ref=agoda`（未登録）でも予約でき channel_code に記録。既存 T04-T08 が回帰しない（壊れたら自分で修正）。

## Step B. Phase 3 残り（T09〜T11）
`CODEX_Phase3-6_実装指示書.md` の Phase3 に従う。self-verify ループで進める。

- **T09 預かる（checkin）**: `verify-dropoff`（drop-off OTP・5回で15分ロック=423）→ タグ＋**写真必須**（Storage）→ 全item同時 checkin → `storage_started_at`/`return_due_at`/active。サイズ修正（12.10-B）・禁止物受入拒否・開披audit（12.10-C/C-1）。写真は端末に残さない。
- **T10 返す（checkout）**: `request-pickup-otp`（**別テーブル pickup_otps**・10分・`otp_plain` 有効期間保持で予約ページ表示）→ `checkout`（部分受け取り・overdueは `overtimeSettled` 無しで409）。drop-off OTP 流用は 401。
- **T11 cron（15分間隔）**: no-show / overdue（猶予15分・上限240,000・daily=null時0・24h/72h通知）/ abandoned（+7日）/ review（完了1h後）。**specs/12 の O1-O10・D1-D4・N1/N2 を時刻注入でテスト**。
- **E2E**: specs/15 の E5〜E11（＋既存E1-E4）が通ること。

## やらないこと（今回スコープ外）
- OTAバウチャー償還フロー本体（レベル2）・サプライヤーAPI（レベル3）。
- Phase4以降（管理/集客/仕上げ）は T11 完了後に別途（`CODEX_Phase3-6_実装指示書.md`）。

## 完了報告（Step A・B 終了時）
コミットID・push先・確認URL・`build`/`test`/`db reset`/該当E2E の結果を報告。AGENTS.md 規約で `git push origin master`（未push確認 `git log origin/master..HEAD`）。

## Codex に貼るプロンプト（そのまま貼る）
```
実装状況: T02・T04〜T08 は完了済み。次を順に実施。仕様が正（specs/）。AGENTS.mdのGit運用に従い、完了後にコミットID・確認URL・テスト結果を報告。
各ステップ後に必ず `npx supabase db reset && npm run build && npm run test`（あればE2E）を実行し、自分の変更で壊れた既存(T04-T08)も自分で直す。解決不能な矛盾のみ報告。

参照: CODEX_次アクション_Phase2一式.md / CODEX_OTA準備_ガードレール指示書.md / CODEX_Phase3-6_実装指示書.md / specs 01,02,06,08,12,13,14,16

Step A（チャネル/OTA汎用化を app に適用・既存コードのリファクタ＋追加マイグレ）:
- sales_channels 新規＋seed10行、bookings.channel を粗カテゴリ化＋channel_code追加、ota_vouchers.provider の固定check削除、price_plans に channel_tier(direct/ota) 追加(unique更新)
- contracts/common.ts の Channel を粗カテゴリenum＋ChannelCode追加、user.ts に channelCode
- lib/pricing を price(size,planHours,channelTier='direct') に（P1-P6緑のまま）
- ?ref=<code> は sales_channels.code に対応・未登録はフォールバックしchannel_code記録（任意OTA対応）
- 予約作成は payment_provider で決済分岐できる構造に、'ota_voucher'は枠だけTODO
- db reset＋build＋test 緑、既存T04-T08 回帰なし

Step B（Phase3 残り T09〜T11）:
- T09 checkin（verify-dropoff/写真必須/全item同時/サイズ修正/禁止物拒否/開披audit）
- T10 checkout（別テーブルpickup_otps/otp_plain予約ページ表示/部分受取/overdue 409/drop-off流用401）
- T11 cron（no-show/overdue/abandoned/review）＋ specs/12 O・D・N を時刻注入テスト
- E2E specs/15 E5〜E11 を通す

各タスク build&test→commit。Step Bまで終えたら受け入れ基準の結果を報告して止まる。
OTA償還本体・レベル3・Phase4以降は作らない。
```
