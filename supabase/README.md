# Vistrial database

Postgres 17 on Supabase, project `onobzewvjsicwxbsdlzw`. Shared by all Divine
Acquisition surfaces; this directory holds the schema for the client documentation
and growth tracking surface served at `/da` (`da.divineacquisition.io`, also
reachable from the unified admin portal at `admin.divineacquisition.io`).

The migrations in `migrations/` are exported from the applied migration history,
so the files and the live database match. `verify/` replays that chain into a
throwaway local Postgres and asserts the rules against it — see
[verify/README.md](verify/README.md), which also documents the one subsystem that
is live on the project but was never exported.

## Why the schema looks like this

**Metrics are rows, not columns.** `metric_definition` is a dictionary; the
baseline and every progress snapshot store values in `snapshot_metric` keyed
against it. This is what makes a snapshot from July directly comparable with a
baseline from March, and it means adding a metric later needs no migration and
does not orphan older snapshots.

**Each metric declares how it aggregates.** A snapshot covers a week; a baseline
covers a month. Summing seven days of revenue against a monthly baseline would
make every client look like they collapsed, so `metric_definition.aggregation`
distinguishes rates (averaged), flows (summed then normalised to a 30-day
equivalent) and stocks (latest reading).

**Each metric declares its direction.** `metric_direction` is why
`growth_for_case_file()` can report what got worse without anyone hand-labelling
it: a fall in response time is an improvement, a rise in cost per lead is not.

## The rules, and where each one lives

| Rule | Enforcement |
|---|---|
| 1. The baseline locks at install and can never be edited | `begin_install()` is the only path that sets `locked_at`, and it refuses without a baseline. `app.guard_snapshot_update`, `guard_snapshot_delete` and `guard_snapshot_child` then reject every write to the snapshot, its metrics and its lead sources. |
| 2. Snapshots, effort and decisions are immutable; corrections create versions | `take_snapshot()` locks on creation. `app.guard_versioned_update` allows an append-only row to acquire nothing but its `superseded_by_id`; `correct_effort()` and `correct_decision()` insert the new version and refuse without a reason. |
| 3. Metrics that got worse are shown too | `growth_for_case_file()` returns the whole dictionary with `improved` computed per metric. There is no server-side filter for callers to abuse. |
| 4. Evidence needs what it proves and when it happened | `record_evidence()` rejects either being blank. `evidence_item.needs_metadata` is a generated column, so anything the Drive sync discovers surfaces as awaiting metadata rather than silently passing. |
| 5. Files live in Drive | The schema stores `drive_file_id` and `drive_url` only. No bytes. |
| 6. Evidence is private, shared by time-limited link | `create_share_link()` mints a token with an expiry between one minute and fourteen days. Drive permissions are never changed permanently. |
| 7. Reports are archived as sent | `generate_growth_report()` writes a `payload` jsonb snapshot. `app.guard_growth_report_update` freezes everything except the Drive reference, which can be written once. |
| 8. Admin-only | Every table has RLS gating on `app.is_admin()`. `anon` has no grants at all. `metric_definition` is the one exception, being a dictionary rather than client data. |

`app` is a private schema, not exposed through the Data API, so the
security-definer helpers in it cannot be called by a client.

## Automation

| Job | Schedule | What it does |
|---|---|---|
| `vistrial-weekly-snapshots` | Mondays 06:00 UTC | `app.take_automatic_snapshots()`, which delegates to `public.take_due_snapshots()` — the same function the admin button calls, so a manual run and the scheduled run cannot drift. |
| `vistrial-ingest-backlog` | every minute | `app.drain_ingest_backlog()`. The backstop that makes an early acknowledgement safe: anything logged but not yet interpreted is picked up here. |
| `vistrial-cross-client-rollup` | every ten minutes | `app.refresh_rollup('cross_client')`. Between runs the value is served with its age, so a late refresh shows as stale rather than as wrong. |

## Ingestion

Two machine doors: GoHighLevel and the payment processor. Both go through
`ingest_receive()` and `ingest_process()`, which are the only way a machine
delivery enters the database. Both are granted to `anon`, as `attempt_sign_in()`
already is, because a webhook arrives with no session — the door's own secret is
what authorises it, and both functions check it themselves.

`ingest_endpoint` is a door. It holds the public key that names it and either a
digest of a shared secret or a Vault reference to a signing key, so the secret to
check against can be found before the body is parsed. `ingest_source` maps a
sending account to exactly one client, which is what makes attribution a lookup
rather than a judgement. `ingest_event_type` lists the types that have handlers.

`ingest_event` is the log. Immutable in its payload and undeletable; only the
outcome of processing may be written. It stores the body as text as well as
`jsonb`, so a payload that could not be parsed is still on record and can be
replayed once something understands it.

### The rules, and where each one lives

| Rule | Enforcement |
|---|---|
| 1. Authenticate before parsing | `ingest_receive()` resolves the door and checks the digest or recomputes the HMAC before it attempts `p_body::jsonb`. A refusal *returns* rather than raising, because raising would roll back the `ingest_auth_failure` row that records it. |
| 2. Log the raw payload before processing it | `ingest_receive()` writes the row and stops. Interpretation happens in a separate call, so no handler can lose a payload by failing to understand it. |
| 3. Duplicate deliveries produce one record | `unique (provider, dedupe_key)`, where the key is the provider's own event id or a digest of the body. `booking.external_ref` is unique per client for the same reason one layer down: a create and an update describing one appointment must not become two commissions. |
| 4. First-touch timestamps stamp once | `app.stamp_once()` on `lead`, which retains the earlier value rather than raising — a redelivered event is routine and must not fail. `lead.response_minutes` is a generated column over the two stamps, so response time cannot be entered by hand from anywhere. |
| 5. Unattributable events are stored and raised | `app.ingest_resolve_case_file()` is lookup-only and returns null when nothing matches. `app.ingest_dispatch()` then writes `unattributed` and raises an owner alert. `map_ingest_account()` clears the backlog by dispatching everything queued against that account. |
| 6. Unknown types are stored and raised | A type absent from `ingest_event_type` lands as `unknown_type` with an alert. Adding a workflow in GoHighLevel without a handler is visible instead of silent. |
| 7. Acknowledge quickly, then process | Receiving and dispatching are separate calls so the route can return 202 first. `app.drain_ingest_backlog()` runs every minute, so acknowledging early can delay processing but cannot lose it. |
| 8. Money moves only on confirmed bookings | `booking_is_creditable()`, unchanged. `app.reconcile_booking_claims()` is now the only matcher: the GoHighLevel handler runs it when an appointment arrives, and `claim_booking()` runs it when an operator logs one, so the two cannot disagree about who gets paid. |
| 9. Nothing is inferred from silence or from an amount | A payment resolves to the invoice it names, or it is stored unattributed. There is no branch that matches a payment on its amount. |

### The three computation layers

Live derived figures are recomputed per read. Frozen artifacts — baselines,
snapshots, statements, issued invoices, published reports — are computed once and
never recomputed. Between them, `rollup_cache` holds the cross-client rollups.

`rollup()` returns an envelope rather than a payload: `computed_at`, an age, and a
`stale` flag come back with every figure, and there is deliberately no accessor
that returns the numbers alone. A rollup that has never run reads as stale rather
than as a set of zeros, and a refresh that fails keeps the previous payload and
records why. `v_ingest_health` is left live and uncached, because a stale answer to
whether data is still arriving is the wrong kind of wrong.

## Configuration is data, not code

Three things used to be decided in the application and are now rows, because each
had an owner and none of them was a compile-time contract.

**The industry template.** `industry_template` and `industry_template_field` hold
what an operator is asked at the end of a shift; `case_file_eod_field` overrides it
per client. Which template a client got was previously inferred with
`row.notes?.includes('med spa')` — the free-text notes column, string-matched — so
an admin tidying a note could silently change the shape of every EOD report, and a
sixth industry needed a deploy. `client_case_file.industry_key` owns it now, and
the migration backfills it by running that heuristic exactly once.
`eod_fields_for_case_file()` resolves template against override in one place.

**The definition of a qualified booking.** A string literal, identical for every
client. It is the sentence an operator is measured against and a disputed booking is
settled with, so it is `client_case_file.qualified_booking_definition`, seeded from
the template and editable per client.

**Who an escalation goes to.** The hub wrote `routed_to: ['DA Admin']`. Nobody is
called that. `app.escalation_recipients()` resolves the real roster — owners, admins
and any manager in scope — and a trigger applies it when the caller leaves the
column empty. `v_staff_name` exposes staff names, and nothing else about them, so an
operator disputing a pay adjustment can find out who made it.

What stayed in the application is the locked EOD core, in
`lib/vistrial/eodCore.ts`: eight fixed fields that are the `EodCore` type.
`app.eod_core_keys()` mirrors them so the database can refuse a configured field
that would shadow one, and the comment on each says to change them together.

## The public door

`role_application` and `submit_role_application()` are the careers form's
destination. Three of the six roles used an in-page form that logged what a
candidate typed to the browser console, discarded it, and told them it had been
received. The function is granted to `anon` — an applicant has no session — so it is
the most exposed in the schema: it caps every field, requires a reachable address,
refuses a sixth application from one address in an hour, and returns nothing it was
not given.

### Landing tables

`tracking_metric_daily` is the landing zone for metric ingestion: one row per case
file, per day, per metric. `rollup_tracking()` aggregates it for a period and is
what lets a snapshot be taken with no human present.

`tracking_funnel_daily` and `response_day` are no longer written directly. They
are caches over `lead`, recomputed for a whole day by
`app.refresh_lead_rollups()` rather than incremented, so replaying an event cannot
inflate them. The upsert names only the lead-derived columns, because ad spend and
revenue on those same rows are owned by admin entry.

## Creating the first admin

Do it through the dashboard (Authentication → Users → Add user) or the Auth admin
API, then promote:

```sql
update public.profile set role = 'admin' where email = 'you@divineacquisition.io';
```

New users default to `operator`. Admin is granted deliberately, never by signing
up.

Do **not** insert into `auth.users` with plain SQL. GoTrue scans several token
columns into non-nullable Go strings, so the NULLs a hand-written insert leaves
behind break every login with `Database error querying schema`. If it has already
happened:

```sql
update auth.users
   set confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change = coalesce(email_change, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       phone_change = coalesce(phone_change, ''),
       phone_change_token = coalesce(phone_change_token, ''),
       reauthentication_token = coalesce(reauthentication_token, '');
```

## Roles, auth and the admin workspace (`ad.divineacquisition.io`)

The control-plane migrations (`20260726221034` onward) add Owner / Admin /
Manager / Operator / Contractor roles, account state, the permission catalogue,
scope, overrides, invite-only signup, impersonation, the credential vault, and
an append-only audit log.

Permission checks run in Postgres through `app.decide()` / `app.require()`.
Explicit deny beats every grant. Refusals name the layer (account state,
lockdown, blocking notice, impersonation, override, role default).

`app.is_admin()` is true for Owner and Admin when the effective state is active,
and it evaluates the acting profile during impersonation so the rest of the
surfaces keep working.

The Next.js surface lives at `/ad` (host `ad.divineacquisition.io` via
`VISTRIAL_CONTROL_HOSTS`, also under the unified portal at
`admin.divineacquisition.io`). Accounts are invited from `/ad/invites`;
acceptance is at `/ad/invite?token=…`.

### Host routing

Each property is a dedicated host. On that host only its surface is served;
other app paths return 404. Localhost and `*.vercel.app` keep path-based access
for previews.

`admin.divineacquisition.io` (`DA_WORKSPACE_HOSTS`) is the unified admin
portal: agreements (`/workspace`), growth (`/da`), control (`/ad`), assessment
admin (`/admin`), and ops (`/vistrial`) share one sidebar. Dedicated hosts below
remain as cutover aliases while DNS moves off `*.vistrial.io`.

| Host env | Default | Surface |
|---|---|---|
| `DA_WORKSPACE_HOSTS` | `admin.divineacquisition.io` | unified admin portal |
| `VISTRIAL_CONTROL_HOSTS` | `ad.divineacquisition.io` | `/ad` |
| `VISTRIAL_ADMIN_HOSTS` | `da.divineacquisition.io` | `/da` |
| `VISTRIAL_ACCT_HOSTS` | `acct.divineacquisition.io` | `/acct` |
| `VISTRIAL_OPS_HOSTS` | `ops.divineacquisition.io`, … | `/vistrial` |
| `VISTRIAL_CAREERS_HOSTS` | `divineacquisition.io`, … | `/hiring` |
| `VISTRIAL_TALENT_HOSTS` | `talent.divineacquisition.io` | `/assessment` |
| `VISTRIAL_ACQ_HOSTS` | `acq.divineacquisition.io` | `/acq` |

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on
every deploy.
