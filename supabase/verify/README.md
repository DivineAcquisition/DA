# Verifying the schema

`migrations/` is exported from the applied migration history, which means the
files describe a database that already exists. That is worth checking rather than
assuming, because a rule enforced by a trigger, a policy or a unique index is only
enforced if the statement that created it actually ran.

`run.sh` replays the whole chain into a throwaway local Postgres and then asserts
the rules against it. Nothing here touches the hosted project.

```bash
sudo apt-get install -y postgresql-17            # from the PGDG apt repository
sudo -u postgres /usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/main \
  -o '-c config_file=/etc/postgresql/17/main/postgresql.conf -p 5433' start

supabase/verify/run.sh
```

It drops and rebuilds `vistrial_verify`, applies every migration in order, then
runs each suite in `suites/` against the result. A failure exits non-zero and
prints the statement that broke.

## What the suites assert

| Suite | Covers |
|---|---|
| `10_ingestion.sql` | Authentication before parsing, the raw body logged before interpretation, one record per delivery however many times it arrives, tenant resolution by lookup only, unknown types and unattributable events stored and raised, a payload that is not JSON kept for replay, the delivery log immutable and undeletable, replay reinterpreting rather than duplicating, the booking match on ingestion, a payment applied only to an invoice it names. |
| `20_rollups.sql` | A cached figure cannot be read without its age. A rollup that never ran reads as stale rather than as zero. A failed refresh keeps the previous payload and says why. Ingestion health is live and uncached. |
| `30_scope.sql` | Role and scope filter at the data layer. Run as the `authenticated` role with Supabase's default grants in place, so the policies are actually in force rather than appearing to work because nothing had a grant. A client sees their own leads and no others; an operator sees the leads on their placements only; `anon` reaches none of it but can still knock on a door. |
| `40_claims.sql` | A manual booking claim goes through `claim_booking()`, which forces the source and the state, refuses a placement that is not the caller's, runs the same matcher ingestion runs, and audits. A claim nothing evidences stays pending and creditable to nothing. |

The suites share one database and run in order: `10_ingestion.sql` builds the
fixtures the rest read.

## What `local/` is standing in for

A Supabase project provides things a bare Postgres does not, so `local/shim.sql`
creates the smallest version of each that the migrations actually use: the `anon`,
`authenticated` and `service_role` roles and Supabase's default grants to them,
`auth.users`, `auth.sessions`, `auth.mfa_factors`, an `auth.uid()` that reads a
settable GUC so a suite can act as any user, the Vault functions, and the
`rls_auto_enable()` event-trigger function the migrations revoke grants on.

`local/pg_cron*` is a stand-in extension that records schedules and runs nothing.
Real `pg_cron` needs `shared_preload_libraries`, and the chain only needs the
`create extension` and `cron.schedule()` calls to succeed.

## The one thing that is not replayable

`local/document_stub.sql` is not part of the schema. The document generation
subsystem — `document`, `document_template`, `document_section`,
`document_template_section`, `document_delivery`, `document_open`,
`anonymisation_flag`, the `v_document_*` views, twelve functions and four enums —
is live on the hosted project but was never exported to `migrations/`. Migration
`20260726221532` puts a manager-scope policy on `public.document`, and
`open_work_for()` reads it, so a clean database cannot reach the end of the chain
without those tables existing.

The stub reconstructs just enough of it, from the column lists in
`lib/supabase/database.types.ts`, to let the chain finish. It is deliberately not
a migration: the real DDL carries defaults, constraints, triggers, RLS and
functions that the generated types do not record, and inventing those would be
worse than naming the gap. Exporting the real migrations from the project is the
fix.

Aside from that subsystem the replayed database matches the hosted one exactly —
same tables, views, functions and enums.

## Over HTTP

`run.sh` proves the database. It does not prove the route handler, which is where
authentication is read off the request, the acknowledgement is returned, and
processing is handed to `after()`.

`http.sh` covers that by driving the real path — Next.js route, `supabase-js`,
PostgREST, Postgres — and asserting on what landed. It needs three processes:

```bash
# 1. The chain applied, with no suite fixtures in the way, seeded with two doors.
supabase/verify/run.sh --schema-only
sudo -u postgres psql -p 5433 -d vistrial_verify -f supabase/verify/local/seed_http.sql

# 2. PostgREST on 3002, and the gateway shim on 3001. The shim maps /rest/v1 and
#    strips the publishable-key bearer, which PostgREST rejects as a malformed
#    JWT. Real Supabase does this translation in Kong.
postgrest supabase/verify/local/postgrest.conf &
node supabase/verify/local/supabase-shim.mjs &

# PostgREST caches the schema at startup, so tell it to look again after a rebuild.
sudo -u postgres psql -p 5433 -d vistrial_verify -c "notify pgrst, 'reload schema'"

# 3. The app, pointed at the shim.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3001 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local npm run dev &

supabase/verify/http.sh
```

There is no auth server in this arrangement, so the signed-in surfaces show their
sign-in screen. The machine doors carry no session, which is exactly why they can
be exercised this way.
