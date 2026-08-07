# DivineACQ Supabase project

Fresh Supabase project for Divine Acquisition. All repo migrations and Postgres
functions from `supabase/migrations/` were applied here.

| | |
|---|---|
| Name | DivineACQ |
| Ref | `hfgattcqlzuyahqywuoq` |
| URL | `https://hfgattcqlzuyahqywuoq.supabase.co` |
| Org | DivineAcquisition™ |
| Region | us-east-1 |
| Plan cost | $10/mo (Pro org) |

## Applied

- **66** migrations (foundation → DA workspace / DocuSeal / operator company settings)
- **75** functions in schema `app`
- Extensions: `pgcrypto`, `pg_cron`, `uuid-ossp`
- Cron: weekly snapshot job (`vistrial-weekly-snapshots`) and ingest-related schedules from migrations

This repo has no `supabase/functions` edge functions — “functions” live as
Postgres `app.*` routines in the migration chain.

## Vercel / local env

```bash
NEXT_PUBLIC_SUPABASE_URL=https://hfgattcqlzuyahqywuoq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable or anon key from dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service_role from Project Settings → API>
DOCUSEAL_API_KEY=<your DocuSeal key>
```

Publishable (anon) key is also available from the Supabase dashboard API settings.
Service role is **not** stored in git — copy it from the dashboard into Vercel.

## First admin

1. Create a user in Authentication (email/password) for your admin.
2. Promote in SQL:

```sql
update public.profile
   set role = 'admin',
       full_name = 'Malik Sannie'
 where email = 'you@divineacquisition.io';
```

On newer control-plane roles, also ensure account state is active / Owner as needed
via `/ad` after first sign-in, or through the control-plane RPCs.

## Workspace defaults

`da_settings` row `id = 1` is seeded with:

- `company_name` = Divine Acquisition  
- `company_rep` = Malik Sannie  
- `public_base_url` = `https://admin.divineacquisition.io`  
- `auto_prefill` = true  

Set `docuseal_api_key` in Admin → Settings (or `DOCUSEAL_API_KEY` on the deploy).
