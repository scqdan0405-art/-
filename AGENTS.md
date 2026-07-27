# AGENTS.md - KONCOCHII (Codex/agent guidelines)

This repository is for KONCOCHII development. Detailed project rules should live in `spec/CLAUDE.md` when the specification bundle is added.

## Required Reading Order

1. `spec/CLAUDE.md` - project rules, technical stack, commands
2. `spec/specs/00-overview.md` - architecture, state machine, pricing, time rules
3. `spec/specs/01-data-model.md` - database schema and DDL
4. `spec/specs/02-api.md` - API definitions
5. `spec/specs/03-user-booking.md`, `04-store-ops.md`, `05-admin.md` - functional specs
6. `spec/specs/06-security.md` - OTP, authorization, RLS; highest priority
7. `spec/specs/07-growth-channels.md`, `08-ota-integration.md`, `09-source-coverage.md`, `10-payment-provider.md`
8. `spec/TASKS.md` - implementation order

If implementation and specifications conflict, the specifications are authoritative. Missing details should be recorded under Open Questions in `spec/TASKS.md` when that file exists.

## Implementation Location

- Build the application as a new Next.js project under repository root `app/`.
- Do not modify `docs/`, `spec/`, or `requirements/`.

## Technical Stack

Next.js 14+ with App Router and strict TypeScript, Supabase/PostgreSQL, Tailwind CSS, next-intl for `en`, `vi`, `ja`, zod, and a payment abstraction under `lib/payment/` with MockProvider for PoC and 2C2P for production.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
npx supabase db reset
```

## Rules

- Store monetary values as integer VND (`bigint`).
- Store DB timestamps in UTC (`timestamptz`); display in `Asia/Ho_Chi_Minh`.
- Keep business logic such as pricing, OTP verification, and state transitions on the server.
- Do not commit secrets such as Supabase service role keys.
- Do not store card data; store PSP tokens only.
- Do not log PII or OTP values.
