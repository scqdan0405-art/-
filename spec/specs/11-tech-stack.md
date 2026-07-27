# 11. 技術選定・環境設定（確定 / Codex はこれに従う）

このファイルは KONCOCHII の技術スタックと環境設定の**確定事項**。他章と矛盾する場合はこの章の選定を採用する。
（00-overview / CLAUDE.md の方針を具体化したもの）

## 決定サマリ

| 項目 | 採用 | 備考 |
|---|---|---|
| 開発言語 | **TypeScript**（strict） | JS は使わない |
| ランタイム | **Node.js 20 LTS** | `.nvmrc` に `20` を置く |
| フレームワーク | **Next.js 14+（App Router）** | React Server Components 前提 |
| データベース | **PostgreSQL（Supabase Cloud）** | マネージド。PoC は無料枠 |
| DBアクセス | **Drizzle ORM** | 型安全クエリ＋マイグレーション管理 |
| 認証 | **Supabase Auth**（店舗・管理者）／利用者はトークンレス | 06-security 準拠 |
| ファイル保存 | **Supabase Storage**（非公開バケット＋署名URL） | 荷物写真 |
| スタイル | **Tailwind CSS** | |
| 多言語 | **next-intl** | en / vi / ja を先行、他はキーのみ |
| バリデーション | **zod** | 全API入力 |
| 決済 | `lib/payment/` 抽象。PoC=**Mock**、本番=**2C2P** | 10-payment-provider |
| メール | **Resend**（開発時は console 出力） | |
| QR生成/読取 | 生成=**qrcode**／読取=**BarcodeDetector**＋**html5-qrcode**フォールバック | |
| レート制限 | **Upstash Redis**（なければ DB フォールバック） | 06-security |
| テスト | **Vitest**（単体）＋ **Playwright**（E2E） | |
| ホスティング | アプリ=**Vercel**／DB=**Supabase Cloud**／資料=**GitHub Pages(docs/)** | |
| Lint/Format | **ESLint**＋**Prettier** | |
| パッケージ管理 | **npm** | lockfile をコミット |

## Drizzle の方針

- スキーマは `app/src/db/schema.ts` に TypeScript で定義し、01-data-model.md の DDL と一致させる。
- マイグレーションは **drizzle-kit** で生成し `app/drizzle/` に置く。Supabase へは drizzle-kit または `supabase db push` で適用（どちらか一方に統一。既存 `supabase/migrations/` がある場合はそれを正とし、Drizzle スキーマを合わせる）。
- サーバー側のみ DB 接続（service role 相当の接続文字列）。クライアントから直接 DB/Supabase を叩かない。
- RLS は全テーブルで有効化（anon 全拒否）。アプリはサーバー経由でアクセスするため RLS は多層防御として維持。

## バージョン固定の目安（package.json）

- next ^14、react ^18、typescript ^5、drizzle-orm 最新安定、drizzle-kit 最新安定
- @supabase/supabase-js ^2、next-intl ^3、zod ^3、qrcode ^1、html5-qrcode ^2
- vitest ^2、@playwright/test 最新、tailwindcss ^3、eslint ^8/9（Next 準拠）
- 実際の最新安定版に合わせてよいが、メジャーは上表に従う。

## 環境変数（`app/.env.example` に記載、実値はコミットしない）

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # サーバー専用。NEXT_PUBLIC を付けない
DATABASE_URL=                     # Drizzle 用 Postgres 接続文字列（Supabase の接続情報）

# アプリ
APP_BASE_URL=http://localhost:3000
DEFAULT_LOCALE=ja

# 決済
PAYMENT_PROVIDER=mock             # mock | 2c2p
TWOC2P_MERCHANT_ID=               # 本番のみ
TWOC2P_SECRET_KEY=                # 本番のみ
TWOC2P_ENV=sandbox                # sandbox | production

# メール
MAIL_PROVIDER=console             # console | resend
RESEND_API_KEY=

# レート制限（任意。無ければ DB フォールバック）
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## ディレクトリ方針（app/ 内）

```
app/
  src/
    app/            # ルート（/ , /store , /admin , /api/v1/...）
    db/             # Drizzle schema.ts, client.ts
    lib/            # payment/ mail/ errors, audit, rate-limit, env
    components/
    i18n/
  drizzle/          # 生成マイグレーション
  supabase/         # seed 等（既存構成に合わせる）
  messages/         # en.json / vi.json / ja.json
```

## Codex への一言（この章を渡すときのプロンプト）

```
spec/specs/11-tech-stack.md を確定仕様として読み、既存の app/ の構成に Drizzle ORM を導入してください。
- app/src/db/schema.ts を 01-data-model.md の DDL に一致させて作成
- drizzle-kit でマイグレーション生成、DATABASE_URL で Supabase に接続
- .env.example を 11章の内容に更新（実値はコミットしない）
- 既存の lib/ や supabase/ と重複しないよう統合し、npm run build / test が通る状態にしてコミット
```

## 未確定（契約後に値を入れるだけ）

- 2C2P の Merchant ID / Secret（契約後）
- Resend の API キー（登録後）
- Supabase 本番プロジェクトの URL / キー（本番移行時）
- 将来 self-host に移す場合は DATABASE_URL と Storage 実装のみ差し替え（アプリ側の変更は最小）
