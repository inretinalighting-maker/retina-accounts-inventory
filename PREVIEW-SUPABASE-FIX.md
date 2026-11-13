# Supabase Preview repair — November 2026

This package updates the `supabase-rollout` branch code only. Do not merge to `main` or deploy to Production.

## Root cause

The Preview UI previously hardcoded "Google Sheets backend", regardless of the API's actual data source. The Supabase adapter also required `SUPABASE_SERVICE_ROLE_KEY`, which was not available in the reported Vercel configuration. Chart of Accounts called a Google-only staging operation that the Supabase adapter rejected.

## Changes

- The backend returns `dataBackend` from `apiBootstrap`, and the frontend displays the backend **only after a successful response**. The label is not evidence of successful Supabase access until bootstrapping completes.
- The Supabase adapter accepts either a server-only `SUPABASE_SERVICE_ROLE_KEY`, or the signed-in administrator's Supabase access token with `VITE_SUPABASE_PUBLISHABLE_KEY`. The latter is subject to Supabase Row Level Security policies. No anonymous bypass is added.
- The Supabase adapter returns an empty staging list; the Google-only staging UI is hidden in Supabase mode.
- Save buttons and attachment copy describe the active backend accurately.

## Vercel Preview configuration

- `RETINA_DATA_BACKEND=supabase` scoped to Preview branch `supabase-rollout`
- `VITE_REQUIRE_AUTH=true` in Preview
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Preview
- `SUPABASE_ADMIN_USER_ID` in Preview
- `SUPABASE_SERVICE_ROLE_KEY` is optional for the new adapter, but **without it** your Supabase RLS policies must allow the authenticated administrator to access the required tables. If they don't, the Preview will display a Supabase 401/403 error. Do not disable RLS to make the error disappear.

## Test before any cutover

1. Commit the modified files to `supabase-rollout` ONLY.
2. Wait for the new Preview deployment and sign in.
3. The dashboard must say `Live mode · Supabase backend` after loading. If it reports an error, inspect the browser-visible error and Vercel function logs.
4. Open Transactions and verify 58 baseline records against Supabase. Test Chart of Accounts and other screens in Preview. Do not perform destructive testing on migrated data.
5. Verify private attachment access and record integrity separately.

**Important:** The ZIP is a code patch, not proof that your Supabase RLS policies or schema support every operation. Build and live integration testing remain necessary. Production must remain Google Sheets-backed until explicit approval.
