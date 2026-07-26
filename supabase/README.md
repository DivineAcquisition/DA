# Vistrial database

Postgres 17 on Supabase, project `onobzewvjsicwxbsdlzw`. Shared by all Vistrial
surfaces; this directory holds the schema for the client documentation and growth
tracking surface served at `da.vistrial.io`.

The migrations in `migrations/` are exported from the applied migration history,
so the files and the live database match.

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

`pg_cron` runs `app.take_automatic_snapshots()` every Monday at 06:00 UTC, which
delegates to `public.take_due_snapshots()` — the same function the admin button
calls, so a manual run and the scheduled run cannot drift.

## Ingestion

`tracking_metric_daily` is the landing zone for the GoHighLevel ingestion: one
row per case file, per day, per metric. `rollup_tracking()` aggregates it for a
period and is what lets a snapshot be taken with no human present.

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
