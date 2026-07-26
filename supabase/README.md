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

## Document generation

Client documents are produced from the tracked record rather than assembled by
hand, so the same ten rules apply and the same approach holds: they live in the
database, not in a form.

| Rule | Enforcement |
|---|---|
| 1. Bound numbers come from the tracked record and are never manually typed | `app.resolve_bindings()` is the only path data takes into a document. `set_document_narrative()` is the only write path into a section body and refuses any section that is not `narrative`. |
| 2. Missing data renders as an explicit gap, never zero or blank | `app.bind()` stamps `status: 'gap'` on a null value, `app.has_gap()` propagates it to `document_section.has_gap`, and the renderer prints "Not captured". A derived figure with a missing input is a gap too, rather than a confident wrong number. |
| 3. Published documents freeze, including their numbers | `publish_document()` writes `app.document_payload()` into `frozen_payload`. `app.guard_document_update` then rejects every column change but the Drive reference and the supersede pointer, `app.guard_document_section` freezes the sections, and `refresh_document_bindings()` requires a draft. |
| 4. Corrections publish a new version with a visible note; originals are never edited | `correct_document()` requires the note, clones the sections into a fresh draft, and links both rows in both directions. The note renders on the cover. |
| 5. Every page carries the DA producer line and the generation date | `@page` margin boxes emitted per document by the renderer. Not a fixed element: Chrome repeats those on every page but resolves `counter(page)` inside one to zero, and a page number that is wrong on every page is worse than none. |
| 6. Vistrial is never the primary brand | `document_template.producer_line`. Vistrial appears after Divine Acquisition, and only on the documents whose numbers are machine generated. |
| 7. Nothing from the client never-see list appears | The resolver reads no operator, no internal note, no decision log, and no DA figure beyond the client's own. Effort hours stay internal even when the effort log is disclosed, and `app.scrub_operator_names()` catches an operator named in a milestone or effort description, where naming them is correct internally. |
| 8. Template changes never alter previously generated documents | A document stores its own copy of every section plus the `template_version` it came from. |
| 9. Case study anonymisation requires admin confirmation | `app.flag_identifiers()` deliberately over-flags. `mark_case_study_ready()` refuses while any flag is undecided, and `publish_document()` refuses a case study outright. |
| 10. No em dashes in generated prose | `app.reject_em_dash()`, a trigger on both `document_section` and `document_template_section`. |

Two details worth knowing before changing this area.

**An audit findings report has to work before an engagement exists.** In this
model the case file is created at the audit, so a prospect is simply a case file
in `audit` status with no install, no placement and no invoices. There is no
separate prospect record to keep in step.

**Resolving a partial identifier before the whole one mangles the prose.** The
scanner flags "Lumen Aesthetics" and also "Lumen" and "Aesthetics" alone, because
either part still identifies the client. Rewriting a part first leaves a fragment
behind, so the panel offers the longest snippet first and
`resolve_anonymisation_flag()` retires any outstanding flag whose text is no
longer in the section.

The Drive copy is written by `lib/documents/serialise.ts` and carries its own
stylesheet, because a reference into an application is not an archive. Google Docs
will not honour `@page` margin boxes, so the archived copy carries the producer
line once at the end rather than on every page; the paginated artefact is the one
printed from the application.

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
