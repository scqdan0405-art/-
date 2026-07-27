# 15. 受け入れテスト計画（E2Eシナリオ・合否条件）

目的：仕様どおり「通しで」動くことを保証する。**各シナリオを Playwright の E2E テストとして実装**（ユニットは12番、契約は13番、ここは結合〜端から端まで）。
「全シナリオが Green」を**Phaseの完了条件**とする。実装が下記の期待結果と一致しない場合、実装が誤り。

## 前提・テスト環境

- seed（01番）: 店舗3件（すべて24h・BT/BV cap20・AP cap30）、price_plans、fee_settings（daily_storage_fee=null）、管理者1、スタッフ各2。
- 決済は `PAYMENT_PROVIDER=mock`（末尾 `4000` のカードは失敗）。メールは console/テスト用モック（送信内容を検証可能に）。
- 時刻は**注入可能**にする（`now()` を差し替えられるクロック）。cron相当の処理はテストから手動起動できるエンドポイント/関数を用意。
- 記法：各シナリオに「事前条件 / 手順 / 合否（Given/When/Then）」。金額はseed料金（S=50/70/100・M=70/100/150・L=100/150/200千VND）。

---

## E1. 予約〜受け取り（ハッピーパス・単一荷物）
- Given: BT店、本日、空きあり。
- When: 店舗選択 → M×6h×1を選択（見積=100,000表示）→ メール/電話/同意入力 → mockカードで決済 → 予約確定。
- Then:
  - [ ] 予約完了画面にQR（ペイロード=bookingTokenのみ、OTP非含有）と drop-off OTP(6桁)が表示。
  - [ ] `booking_confirmation` メールが1通、OTPとbookingUrlを含んで送信される。
  - [ ] 店舗タブで bookingToken+OTP → verify成功 → タグ+写真で checkin → item=stored、booking=active、return_due_at=預入時刻+6h。
  - [ ] 受取: 「受取OTP送信」→ `pickup_otp` メール送信 → そのOTPで checkout → item=returned、booking=completed。
  - [ ] 管理ダッシュボード: 予約1・売上100,000・返却1。精算内訳が gross と一致（店舗40,000等）。

## E2. 複数荷物・部分受け取り
- Given: E1同様、M×1 + S×1（合計170,000）。
- When: 両方 checkin（stored×2）→ 受取OTPで S だけ checkout。
- Then:
  - [ ] S=returned、M=stored のまま、booking=**active継続**。
  - [ ] 残りMを別の受取OTPで checkout → booking=completed。
  - [ ] 途中で店舗の保管中一覧に M が1件残って表示される。

## E3. 容量オーバー（同一時間帯）
- Given: BT(cap20) の同一時間帯に18pt占有。
- When: L(3pt) を同時間帯で予約しようとする。
- Then: [ ] `CAPACITY_FULL(409)`。予約は作成されず、決済も発生しない。M(2pt)なら成功しちょうど20。

## E4. 夜またぎ容量（②の回帰）
- Given: BT、23:00に12h預入で18pt（翌11:00まで占有）。
- When: 翌08:00開始のM(2pt)（翌11:00と重なる）を予約。
- Then: [ ] `CAPACITY_FULL(409)`（旧・日付単位モデルでは漏れていたケース）。重ならない時間帯なら成功。

## E5. 同時予約レース
- Given: 同一店舗・同一時間帯、重なり18pt・cap20。
- When: M(2pt)予約を2件ほぼ同時に送信。
- Then: [ ] **片方のみ成功・もう片方 CAPACITY_FULL**。占有合計が20を超えない（行ロックで直列化）。

## E6. 決済失敗
- When: 末尾4000のカードで決済。
- Then: [ ] `PAYMENT_FAILED(402)`、booking=payment_failed、容量ホールド解放、確認メール送られない。

## E7. 冪等性（二重送信）
- When: 同一 `Idempotency-Key` で予約作成を2回。
- Then: [ ] 2回目は同一 bookingNo を返す。予約・決済・ホールドは1件のみ。

## E8. no-show 自動キャンセル
- Given: paid、預入なし。時刻を arrival_slot_start+3h+1分 に進める。
- When: no-show cron を起動。
- Then: [ ] booking=cancelled(no_show)、refund=total−20,000、refund_status=pending、ホールド解放、`booking_cancelled_noshow` メール送信。

## E9. 超過（猶予・課金・24h打ち止め）
- Given: 6hプランで stored、return_due_at 到達。
- When/Then:
  - [ ] +15分で checkout → 超過0（猶予内）。
  - [ ] 別予約で +16分 → checkout時に超過10,000表示、`overtimeSettled` なしでは `OVERTIME_UNSETTLED(409)`、精算チェック後に returned。
  - [ ] +30時間 → 超過は240,000で打ち止め（daily_fee=nullなので日額は発生しない=0）。`overtime_started` / `overtime_24h` メールが各1回。

## E10. OTP ロック
- Given: paid、drop-off OTP。
- When: 誤りOTPを5回。
- Then: [ ] 5回目で `OTP_LOCKED(423)`、15分ロック、audit記録。以後は正解でも423。管理画面からロック解除 → 正解で verify成功。
- 追加: [ ] pickup OTP は10分超過で `OTP_INVALID(401)`（fail_count加算なし）、1回使用後の再use も401。drop-off OTP を checkout に流用 → 401。

## E11. サイズ不一致・禁止物（12.10）
- [ ] Sで予約→checkinでMに修正 → 差額+30,000を店頭精算として記録、size=M・points 1→2。
- [ ] 禁止物で受入拒否 → booking=cancelled(prohibited_item)、refund=total−手数料、`prohibited_item_refused` メール、ホールド解放。

## E12. キャンセル可否（状態遷移）
- [ ] paid（預入前）→ 利用者キャンセル成功、refund=total−20,000、`booking_cancelled_user` メール。
- [ ] active（stored後）→ キャンセル不可（UIに出ない/API 409）。

## E13. 多言語
- [ ] locale=vi で予約 → 画面表示と送信メールが vi テンプレート。未整備ロケールは en にフォールバック。

## E14. 認可
- [ ] スタッフコードなしで店舗API → 403。他店舗の予約を操作 → 404（存在秘匿）。
- [ ] admin ロールなしで /admin/* → 404。anon から Supabase 直アクセス → 全拒否。

## E15. 集客・管理レポート
- [ ] `?ref=ota_trip` 流入で予約 → channel=ota_trip 記録 → 日次レポートにチャネル別で反映。
- [ ] 日次レポート（店舗×日）の預かり数・キャンセル数・売上が実データと一致。CSV出力の合計がダッシュボードと一致。

---

## 実行・完了条件

- `npm run test:e2e`（Playwright）で E1〜E15 を実行。**全て Green が各Phaseの完了条件**。
- 金額・時刻・状態は12番の期待値、入出力は13番の契約に一致すること。
- テストで使う時刻操作・cron手動起動・メールモックの仕組みを T03/T11 で用意しておく。
- ここに無い異常系で判断したら `spec/TASKS.md` の Open Questions に追記。
