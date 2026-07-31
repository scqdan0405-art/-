# Codex 指示書 — Phase 3〜6（T08〜T17）

作成: 2026-07-28 ／ 前提: **Phase 2（予約フロー T04〜T07）完了後に着手**。仕様が正（specs/）。
Phase単位で「指示 → 動作確認 → 次へ」。各タスクで `npm run build && npm run test` を通してコミット（`feat(T0x): ...`）。Git運用は AGENTS.md（master全体push・force-push禁止）。

共通参照: `specs/02-api`（API）・`04-store-ops`・`05-admin`・`06-security`・`07-growth-channels`・`12-domain-rules`（期待値）・`13-api-contracts`（zod）・`14-notifications`・`15-acceptance-tests`・`16-auth-and-accounts`。

---

## Phase 3: 店舗オペレーション（T08〜T11）

### T08 店舗Auth＋スタッフコード＋ホーム
- **認証（specs/16 厳守）**: 店舗アカウント（Supabase Auth email+password）。role/store_id は **JWT `app_metadata`**（`user_metadata` は認可に使わない）。`/store/*` は `role='store'`、不一致/未ログインは **404**（存在秘匿）。store_id は **JWTを正**とし、リクエストボディの店舗指定は信用しない。
- **must_change_password**: フラグ立ちの店舗は middleware で変更画面へ強制リダイレクト（変更完了まで全画面ブロック）。
- **スタッフコードゲート**: 操作前に4桁コード入力 → **サーバーセッションに15分保持**（localStorage不可）。以降の店舗APIは `x-staff-code` を毎回照合し、`audit_logs.actor_id=staff.id`。15分無操作で再入力。無効/失効コードは403。
- **ban**: banされた店舗アカウントは既存セッションでも次のAPIから拒否。ログイン5回失敗/15分ロック。
- **ホーム `/store`**: 大きな2ボタン（①預かる ③返す）＋保管中一覧（タグ/サイズ/返却期限、期限超過は赤＋超過額）。15秒ポーリング。本日の預かり/返却カウンタ（自店舗）。UIは vi 既定・en 切替。
- **受入(specs/04・16)**: [ ] コード未入力で全操作API 403 [ ] role不一致で404 [ ] must_change_password で他画面に進めない [ ] ban即失効。

### T09 預かるフロー
- QRスキャン（`BarcodeDetector`＋`html5-qrcode`フォールバック）or 予約番号手入力 → `POST /store/verify-dropoff`（drop-off OTP口頭確認・失敗カウント/5回で15分ロック=423）。
- `POST /store/checkin`: 荷物ごとにタグ番号＋**写真必須**（撮影なしで先へ進めない）。写真は Supabase Storage 非公開バケット。**全item同時**（分割不可=12.10-A）。最初のcheckinで `storage_started_at=now()`・`return_due_at` 計算・booking→active。
- **サイズ修正(12.10-B)**: 実物が違えばサイズ変更→差額 `size_adjustment_vnd` 店頭精算・容量ポイント再確保（超過なら受入不可）。
- **禁止物/開披/利用拒否(specs/04・12.10-C/C-1)**: 受入拒否ボタン→`cancelled(prohibited_item)`・`refund=total−cancellation_fee`・audit。開披（責任者立会い）をaudit。写真は端末に残さずアップ後破棄。
- **受入**: [ ] 写真なしで保管開始不可 [ ] OTP5回失敗で15分ロック＋audit [ ] verify-dropoff は自店舗・status=paidのみ。

### T10 返すフロー
- QR/予約番号 → `POST /store/request-pickup-otp`（pickup OTP 10分・**別テーブル**・既存未使用は失効・送信先マスク表示・レート3回/15分）。`otp_plain` を有効期間だけ保持し予約ページ表示に供する（06）。
- 利用者がOTP入力 → `POST /store/checkout`（部分受け取り可）。overdue item は `overtimeSettled:true` なしで返却不可（`OVERTIME_UNSETTLED` 409）。全item返却で booking→completed。
- **受入**: [ ] pickup OTPなしで返却不可（drop-off OTP流用は別テーブル検証で401） [ ] 2個口の1個返却で残1個一覧に残りactive維持 [ ] overdueは精算チェックなしで返却不可。

### T11 Cronジョブ（15分間隔）＋ユニットテスト
- ① no-show: `paid` かつ `arrival_slot_start+3h<now` → `cancelled(no_show)`・`refund=total−noshow_fee`・通知。
- ② overdue: `stored` かつ `return_due_at<now` → `overdue`・overtime再計算（猶予15分・上限240,000・以降 daily_storage_fee は null時0）。初回＋24h＋72h(移送予告)通知。
- ③ abandoned: `overdue` かつ `return_due_at+relocate_after_days(7)<now` → `abandoned`フラグ＋管理者通知。
- ④ review: `completed` 1時間後にレビュー依頼（送信済フラグで1回）。
- **テスト**: specs/12 の O1〜O10・D1〜D4・no-show N1/N2 を境界時刻で。時刻注入で検証。

**Phase3 貼付プロンプト**
```
Phase 2 完了確認済みとして Phase 3（店舗オペ T08〜T11）を実装。
CODEX_Phase3-6_実装指示書.md と specs/04,06,12,13,14,16 を読む。
16認証(role/store_id=JWT・不一致404・must_change_password・スタッフコード15分ゲート・ban即失効)、
別pickup_otpsテーブル(drop-off流用不可)、写真必須、cron4種のテスト(12のO/D/N)を必ず満たす。
各タスクbuild&test→commit。T11まででE2E(specs/15)のE5〜E11相当を通し、結果を報告して止まる。
```

---

## Phase 4: 管理（T12〜T14b）

### T12 adminロール＋ダッシュボード
- `/admin/*` は `app_metadata.role='admin'`、無しは **404**。`GET /admin/dashboard`。
- KPIカード（総予約/保管中item/総売上/返却完了/no-show）、店舗別テーブル（予約数・売上・稼働率）、収益内訳（売上−店舗40%−決済3%−保険6%−システム5%）。

### T13 予約管理
- `/admin/bookings`（予約番号/メール/電話の部分一致・状態/店舗/期間・50件ページング）。詳細ドロワー（全項目＋item＋audit_logsタイムライン）。
- 操作: 手動キャンセル（返金額入力＋理由必須・paidのみ）／OTPロック解除。メール・電話はマスク表示（フルは詳細のみ）。

### T14 精算＋マスタ管理＋アカウント管理
- `/admin/settlement`（月次・店舗別・CSV UTF-8 BOM）。
- マスタ: 店舗（有効/無効・容量・営業時間）、price_plans（新valid_from追加方式・過去行編集不可）、fee_settings（**daily_storage_fee_vnd=null時は未設定警告・0扱い**）、通知テンプレ（`/admin/templates`）。
- **アカウント管理(specs/16)**: 店舗アカウント作成（Admin API・app_metadataにrole/store_id・初回PW自動発行＋must_change_password）・ban・強制リセット。スタッフコード自動生成（4桁・弱い並び/重複回避）・失効・再有効化（削除/再割当なし）。

### T14b 日次レポート
- `/admin/daily`（店舗×日別: 預かり数・S/M/L内訳・返却・キャンセルno-show/利用者別掲・超過・売上・チャネル別内訳）。CSV。店舗ホームの本日カウンタと整合。

**Phase4 貼付プロンプト**
```
Phase 4（管理 T12〜T14b）を実装。specs/05,02,16,13 を読む。
adminロール無しは404。収益内訳/精算CSV(BOM)/日次レポートCSV。
料金はスナップショット不変(price_plans新valid_from方式)。fee_settings daily=null時は未設定警告+0扱い。
店舗アカウント作成・ban・強制PWリセット、スタッフコード管理(specs/16)。
各タスクbuild&test→commit。E2E(specs/15)E14/E14b/E15相当を通し報告して止まる。
```

---

## Phase 5: 集客チャネル（T15a〜T15c・specs/07）

### T15a SEO公開ページ＋トラッキング
- `/[locale]/stores/[storeCode]`（SSG/ISR・`LocalBusiness` JSON-LD・7ロケールhreflang・OGP・`sitemap.xml`/`robots.txt`）。
- 全着地URLで `?ref=`＋UTMをセッション保持→予約時に `channel`/`referral_code` 保存。

### T15b ウォークイン短縮フロー
- `/?ref=store_poster&store=<code>` で店舗・利用日=今日・到着枠=現在時刻をプリセット（3タップで決済）。※追加補償はPoC非表示（スキーマのみ）。

### T15c パートナー＋POP/ポスター＋問い合わせ＋レビュー
- `/admin/partners` CRUD＋`GET /admin/partners/:id/pop?format=pdf`（QR付A5）／`GET /admin/stores/:id/poster?format=pdf`。
- 問い合わせフォーム＋`/admin/inquiries`（open/closed・対応メモ・管理者通知）。レビュー依頼メールcron（T11④と連携）。

**Phase5 貼付プロンプト**
```
Phase 5（集客 T15a〜T15c）を実装。specs/07,02,05 を読む。
SEO公開ページ(SSG/JSON-LD/hreflang/sitemap)、ref+UTM→channel保存、ウォークイン短縮、
パートナー/店舗POP PDF、問い合わせ、レビュー依頼cron。各タスクbuild&test→commit。報告して止まる。
```

---

## Phase 6: 仕上げ（T15・T16・T17）

### T15(i18n) 全キー整備
- en/vi/ja 完備、ko/zh-CN/zh-TW/hi は en フォールバック。ハードコード文言ゼロ。375px実機幅・Lighthouse確認。

### T16 E2E（Playwright）
- **specs/15 の E1〜E15＋E14b（認証/アカウント）＋E14c（OTP不達回避策）を実装**。時刻注入・cron手動起動・メールモックを利用。**全Greenが完了条件**。

### T17 セキュリティ自己監査
- `specs/06` 全項目をチェックリスト化し `SECURITY_AUDIT.md` に結果記録（OTP別テーブル/平文非保存・RLS anon全拒否・service roleサーバのみ・PII/OTPログ非出力・写真署名URL・保持期間cron）。

**Phase6 貼付プロンプト**
```
Phase 6（仕上げ T15 i18n / T16 E2E / T17 セキュリティ監査）を実装。specs/06,14,15 を読む。
i18nはen/vi/ja完備・他はenフォールバック・ハードコード禁止。
E2EはE1〜E15＋E14b＋E14cを全Green。SECURITY_AUDIT.mdにspecs/06全項目の検証結果。
各タスクbuild&test→commit。全E2E Greenを最終報告。
```

---

## 進め方（全体）
Phase2完了 → T02受入確認済 → Phase3 → 確認 → Phase4 → … → Phase6。各Phase末で `npm run build && npm run test` と該当E2E Green、AGENTS.md規約で `git push origin master`（未push確認）→ コミットID・確認URL・テスト結果を報告。
