# Emblem

> **⚠️ Every time you pull updated code, run `npm run migrate` before starting the dev server.** Code changes and database changes ship together in `db/schema.sql`, but only the code half applies automatically — the database half only updates when you run the migration. Skipping this shows up as confusing raw Postgres errors (`column does not exist`, `value too long for type character varying`) that look like bugs but are actually just an out-of-date database. As of this version, these specific errors are auto-translated into a clear "run npm run migrate" message instead of the raw driver error — but running migrate proactively after every update avoids hitting them at all.
>
> **This update specifically fixes a severe one**: `rate_limit_hits.bucket` was `VARCHAR(60)`, but every actual bucket string used in the app (login, register, checkout, and all three loader endpoints) is 70–82 characters. This meant rate limiting has been silently failing on every single one of those endpoints — not a cosmetic bug, a real one, and likely the cause of "the key works but the in-game menu shows anyway" if you saw that: the auth request was failing at the rate-limit check, before your key was ever even looked at. Run `npm run migrate` to pick up the fix.

A premium Roblox script/key platform: real key-based loader authentication (not a static file behind a header check), HWID binding, Stripe payments, and a full admin dashboard with RBAC and audit logging.

Built with **Next.js 14 (App Router, TypeScript)**, **Tailwind CSS**, **Neon (Postgres)**, and **Stripe**.

---

## What's actually verified vs. what needs your own testing

I'm being specific about this because it matters for a security-critical project:

**Tested against real interpreters/tools during development, not just written:**
- The full loader auth handshake (bootstrap loader → `/api/loader/auth` → single-use session token → `/api/loader/payload`) — I extracted the actual Lua the server generates and ran it against a mocked HTTP layer through a real Lua 5.1 interpreter. Verified: valid key succeeds, invalid key is rejected, no key set makes zero network calls, and **replaying a captured/consumed session token is actually rejected**, not just theoretically blocked by code I never ran.
- TOTP (2FA) generation/verification round-trips correctly via `otplib`.
- A full `next build` succeeds cleanly (all 34 routes, no errors) — I caught and fixed two real bugs this way: two GET routes that would have been statically cached at build time instead of reading live DB config, and a `useSearchParams()` usage that needed a Suspense boundary.
- `tsc --noEmit` passes with zero errors, and caught a real bug (a local `confirm` state variable was shadowing `window.confirm()`).

**Written carefully but not live-tested (no live Postgres or Stripe account in this environment):**
- Every database query — I reasoned through each one for correctness (parameterization, idempotency, atomicity) but haven't run them against a live Postgres instance.
- The Stripe checkout + webhook flow. The idempotency logic specifically: I designed it with an atomic claim pattern (`UPDATE ... WHERE status = 'pending'`) specifically so concurrent/duplicate webhook deliveries can't double-issue a key — but this needs real testing with Stripe's CLI (`stripe listen --forward-to`) and test-mode webhook replays before you trust it with real money.
- Rate limiting is DB-backed (see below) — logically sound but not load-tested.

**Do this before going live**: run the full purchase flow in Stripe test mode, trigger a webhook retry manually (Stripe CLI supports this), and confirm exactly one key gets issued. Also run a real key through the loader auth flow against your deployed API before selling anything.

---

## Architecture decisions worth knowing about

- **Database driver**: `@neondatabase/serverless` (HTTP/WebSocket-based), not a raw `pg.Pool`. This matters because the app deploys to Vercel serverless — a traditional TCP pool gets recreated on every cold start, and concurrent invocations can exhaust a database's connection limit.
- **Sessions**: opaque random tokens, hashed before storage (same pattern as passwords), not JWTs — this is what makes "log out other devices" and admin session revocation actually work, since a JWT can't be un-issued without a separate revocation list anyway.
- **Middleware vs. real authorization**: `middleware.ts` only checks for cookie *presence* to redirect unauthenticated page loads for UX — it cannot reach the database reliably from the edge runtime. The actual, authoritative authorization check (`requireAdmin()`, `requireOwner()`, `requireUser()` in `lib/rbac.ts`) runs inside every single API route and page layout. Never assume middleware.ts is the security boundary; it isn't.
- **The loader/payload split**: `/script/loader/emblem.lua` is public and contains zero sensitive logic — just the handshake protocol. The actual script only ever leaves the server after a validated key + HWID + unused nonce produces a single-use session token, which is then consumed exactly once by `/api/loader/payload`. Reading the public loader file tells you the protocol, not how to bypass it.
- **HWID and IP hashing**: neither is ever stored raw — both are hashed with a server-side pepper (`HWID_HASH_PEPPER`) before hitting the database, so a database leak doesn't hand out raw device identifiers or IP addresses.
- **Honesty about client-side limits**: per the original spec, this system is designed so *unauthorized* users cannot retrieve the payload merely by knowing the URL — but nothing stops a legitimately authorized user from capturing what their own client receives after a valid handshake. No client-side delivery system can prevent that; don't let anyone tell you otherwise.

---

## 1. Set up Neon (database)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled connection string** into `DATABASE_URL`.

## 2. Set up Stripe

1. Get your API keys from the [Stripe dashboard](https://dashboard.stripe.com/apikeys) → `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Create a webhook endpoint pointing at `https://<your-domain>/api/webhooks/stripe`, subscribed to at minimum: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. For local testing, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

## 2b. Set up NOWPayments (crypto payments)

1. Sign up at [nowpayments.io](https://nowpayments.io), specify an outcome wallet, and generate an API key → `NOWPAYMENTS_API_KEY`.
2. In Store Settings, generate an **IPN Secret Key** → `NOWPAYMENTS_IPN_SECRET`. This is separate from the API key and is what verifies webhook (IPN) authenticity — don't mix them up.
3. No manual callback URL configuration needed — the checkout code passes `ipn_callback_url` on every payment it creates, pointing at `${SITE_URL}/api/webhooks/nowpayments`.
4. **Test in Sandbox before going live** (see [their sandbox docs](https://documenter.getpostman.com/view/7907941/T1LSCRHC)) — I verified the signature-verification logic against hand-built HMAC test vectors, but haven't been able to run a real payment through their sandbox from this environment, so treat the full end-to-end flow (create payment → send test funds → webhook fires → key issued) as unverified until you've run it yourself.
5. If you'd rather use a different processor (CoinGate, BTCPay Server, etc.), everything crypto-specific lives in `lib/nowpayments.ts` and `app/api/webhooks/nowpayments/` — the rest of the checkout flow doesn't care which processor is behind it.

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in every value in `.env.example` — `DATABASE_URL`, `SESSION_SECRET`, `HWID_HASH_PEPPER`, and `KEY_ENCRYPTION_SECRET` (all 64+ char random strings — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`, generate each separately), Stripe keys, `DISCORD_INVITE_URL`, `SITE_URL`.

**`KEY_ENCRYPTION_SECRET` specifically**: license keys are stored encrypted (AES-256-GCM) so admins/owners can look up a customer's actual key value, and buyers can view their own key on their dashboard — not as raw plaintext, but reversibly, using this secret. Losing it permanently loses the ability to decrypt every key already issued (they'll silently fall back to showing only the masked preview, not crash) — back it up somewhere outside the database, e.g. a password manager, not just in Vercel's env var UI.

## 4. Install, migrate, seed

```bash
npm install
npm run migrate    # applies db/schema.sql — safe to re-run
npm run seed        # optional: adds 3 example pricing plans
```

## 5. Create your first admin account

1. Register a normal account through the site.
2. Set `INITIAL_ADMIN_EMAIL` in your env to that account's email and re-run `npm run migrate` — it promotes that user to `admin`. Or just run directly:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
   ```
3. Log in again — you'll see an **Admin** link. Set up 2FA immediately from `/dashboard/admin/security`.

## 6. Upload your first script version

Two ways to do this — same result either way, use whichever fits:

**Small scripts**: from `/dashboard/admin/scripts`, paste your Lua payload directly, set a version number, check "make active immediately," and upload.

**Large scripts** (the browser textarea gets impractical past a few hundred KB): use the CLI tool instead, which writes straight to the database from a local file:
```bash
npm run upload-script -- ./YourScript.lua 1.0.0 --enable
# optional flags: --notes "what changed" --executors "Xeno,Solara,Wave"
```
Requires `DATABASE_URL` to be set in your local `.env` (or `.env.local`) pointing at the same database your deployment uses — this writes directly, it doesn't go through the website at all.

Either way, this is what `/api/loader/payload` serves after a successful auth handshake — it's never rendered into any public page.

**Self-verifying payloads**: your script can independently re-check its own key at runtime, via `POST /api/loader/verify` (`{ key, hwid } → { valid: true|false }`). This is a *second*, independent check — it doesn't replace the real handshake in `/api/loader/auth`, which remains the only way to obtain the payload at all. What it adds: if a decrypted copy of your script ever ended up outside the normal loadstring flow (saved, shared, re-run standalone), it still can't run without the server actively confirming the key is valid right now.

There are two variants of this, and which one you upload matters:
This ships as one file (`Emblem.lua`) with a `testing_key`/`verificationstring` pair at the very top:
```lua
local testing_key = ""                    -- set to match verificationstring to skip verification locally
local verificationstring = "cwishdi3aicsj" -- change this before every real upload, see below
```
Set `testing_key` to the same value as `verificationstring` while developing, and the script skips straight to your real code with no network call. **Before uploading this file for real customers, blank `testing_key` back to `""`.**

One thing worth understanding, not just taking on faith: blanking `testing_key` alone is not airtight. `verificationstring` is still sitting in plain text in the file every customer receives — anyone who reads it could copy that exact value into their own `testing_key` and bypass verification the same way you do. The fix that actually closes this is changing `verificationstring` to a new random value (or removing the whole block) before each upload, so the value that leaked with the last version is worthless against the next one. Blanking `testing_key` alone stops *accidental* left-on bypasses; it doesn't stop someone who deliberately reads the file.

If verification fails (no key, wrong key, or key no longer valid), a small black-and-white in-game box appears — draggable by its title bar, with an X to close it — with a key input, a **Get Key** button (copies your pricing page link to clipboard), and a **Check Key** button (re-verifies whatever's typed in, and if valid, continues into your script automatically — no re-run needed). The rest of your script only executes after this passes, one way or another.

**If the landing page shows "Offline" even though a script version is enabled**: this was a real bug, now fixed — disabling any version correctly set the site-wide status to offline, but enabling a version never set it back to online, in both the admin panel and the CLI upload tool. If you hit this before the fix, either re-run `npm run upload-script -- ... --enable` now, or just flip it manually from `/dashboard/admin/settings`.

## 7. Run locally / deploy

```bash
npm run dev      # local dev
npm run build    # production build (verified working — see above)
npm start
```

Deploys cleanly to **Vercel**: connect the repo, set every env var from `.env.example` in the Vercel project settings, and deploy. Point `emblem.gg` at it and update `SITE_URL` accordingly (the loadstring shown on the landing page and the loader's internal URLs both derive from this).

---

## Pre-launch checklist

- [ ] `SESSION_SECRET` and `HWID_HASH_PEPPER` are real random values, not the placeholders
- [ ] Stripe webhook endpoint is configured and its secret matches `STRIPE_WEBHOOK_SECRET`
- [ ] Ran a full test-mode purchase and confirmed exactly one key was issued
- [ ] Tested a Stripe webhook retry (via the CLI) and confirmed no duplicate key was issued
- [ ] Uploaded a real script version and successfully ran the loadstring in an actual executor
- [ ] Admin account has 2FA enabled
- [ ] `DISCORD_INVITE_URL` points to your real server
- [ ] Reviewed `pricing_plans` in the admin dashboard (or via `npm run seed`) — the seeded values are placeholders

---

## Project structure

```
emblem/
├── app/
│   ├── page.tsx                      # landing page
│   ├── pricing/                      # pricing + Stripe checkout trigger
│   ├── login/ register/              # auth pages
│   ├── discord/                      # redirect, configurable from admin
│   ├── script/loader/emblem.lua/       # the public bootstrap loader (route.ts)
│   ├── dashboard/                    # user dashboard (keys, security) + dashboard/admin/ (users, keys, scripts, analytics, audit logs, 2FA — role-gated, nested here rather than a separate top-level route)
│   └── api/
│       ├── auth/                     # register, login, logout, sessions, change-password, totp/*
│       ├── keys/                     # user's own keys, HWID reset
│       ├── loader/                   # auth + payload — the core security boundary
│       ├── checkout/, webhooks/stripe/
│       ├── admin/                    # every admin action, each gated by requireAdmin()/requireOwner()
│       ├── config/, plans/           # public read-only endpoints
├── lib/
│   ├── db.ts                         # Neon serverless driver connection
│   ├── auth.ts                       # sessions, password hashing
│   ├── rbac.ts                       # the REAL authorization checks (not middleware.ts)
│   ├── crypto.ts                     # key/HWID/token hashing, license key generation
│   ├── rateLimit.ts                  # DB-backed (this app has no shared memory between invocations)
│   ├── audit.ts                      # audit_logs / security_events writers
│   ├── config.ts                     # site configuration (DB-backed, admin-editable)
│   └── stripe.ts
├── db/
│   ├── schema.sql                    # full schema, idempotent
│   ├── migrate.ts
│   └── seed.ts                       # optional example pricing plans
├── middleware.ts                     # UX-only redirect, NOT the security boundary
└── components/                       # Toast, CopyButton, GridBackground, SiteNav
```

## Known gaps / not implemented

Being upfront about what didn't make it in:

- **⚠️ Next.js version**: this project is pinned to `14.2.35` (the latest patched 14.x release at build time). A subsequent Next.js security advisory (GHSA-955p-x3mx-jcvp, disclosed after 14.2.35 shipped) affects `next` versions before `15.5.21`/`16.2.11`, with no back-port to 14.x — `npm audit` will flag it. Reading the advisory closely: it only affects apps combining React **Server Actions** (`'use server'` functions) with experimental **Cache Components** — this codebase uses neither (every mutation goes through a traditional Route Handler in `app/api/`, and there's no `'use server'` anywhere), so it's very likely not exploitable here as built. That said, upgrading to a patched 15.x/16.x release is straightforward but not risk-free: Next 15 made `cookies()`, `headers()`, and dynamic route `params` asynchronous, which touches most files in `lib/auth.ts`, `lib/rbac.ts`, and every `[id]/route.ts` handler in this project. I did not make that change here because I couldn't re-verify all ~15 affected files against a real build within this session — do it as a deliberate, tested upgrade before going live, not a rushed one. Run `npm audit` after cloning to confirm current status.
- **Email verification / password reset via email** — would require an actual email-sending service (Resend, Postmark, SES, etc.), which wasn't specified. The registration/login flow works without it, but there's no self-service "forgot password" yet.
- **Discord OAuth linking** — the `discord_id`/`discord_username` columns exist and are shown in the admin user list, but nothing populates them yet; that would need a Discord OAuth app.
- **Roblox account verification** — `roblox_user_id`/`roblox_username` are populated automatically from what the loader reports at auth time (self-reported by the client, like most script hubs), not independently verified via the Roblox API.
- **2FA recovery codes** — if an admin loses their authenticator device, the only recovery path right now is direct database access (`UPDATE users SET totp_enabled = FALSE WHERE id = '...'`). Worth adding backup codes before relying on this in production.
