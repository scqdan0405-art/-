# KONCOCHII App

Next.js development environment for KONCOCHII Phase 1.

## Setup

```bash
npm install
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Open:

- `/`
- `/store`
- `/admin`

## Verification

```bash
npm run build
npm run lint
npm run test
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-only Supabase service role key. Never expose this to the browser.
- `PAYMENT_PROVIDER`: `mock` for PoC, `twoc2p` after production configuration is available.

## Open Questions

- The repository did not contain `spec/`, `docs/`, or `requirements/` at setup time, so the initial SQL schema is a conservative baseline and should be reconciled with `spec/specs/01-data-model.md` once the specification bundle is added.
- The exact booking state machine, pricing rules, and 2C2P contract details need to be aligned with `spec/specs/00-overview.md` and `spec/specs/10-payment-provider.md`.
