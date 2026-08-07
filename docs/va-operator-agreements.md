# VA / operator DocuSeal agreements

Divine Acquisition fills operator (VA) agreements the same way
[NovaraCleaningui](https://github.com/DivineAcquisition/novaracleaningui) fills
its VA Independent Contractor docs: **exact DocuSeal field names**, company
countersign values, and a filter that drops anything the current template
revision does not have.

## Where it lives

| Piece | Path |
|-------|------|
| Exact field builders | `lib/workspace/operator-agreement.ts` |
| Generic alias matching | `lib/workspace/field-mapping.ts` |
| Send + company submitter | `lib/workspace/actions.ts` → `createDocuSealSubmission` |
| Branded signing email | `lib/workspace/email.ts` (Resend, Divine Acquisition) |
| Tokenized signing URL | `https://admin.divineacquisition.io/s/<token>` → DocuSeal |
| Preview on Field mapping | `/workspace/mapping` |
| Company identity | Settings → Company countersign |

## Template shapes

Inferred from the DocuSeal template **name** (same heuristic as Novara):

- **standard** — default VA Independent Contractor Agreement  
  Signer (`Contractor`): `Contractor Name`, `Full Name`, `Legal Name`,
  `Full Address`, `Mobile Number` (digits-only for NUMBER fields), `Email`,
  `Date`, `Contractor Date`, `Authorized Rep` (company rep printed name).  
  Company: `Effective Date`, `Company Date`, `Company Signature`, …

- **hourly** — name contains `hourly`  
  Signer: `Contractor Name`, `Authorized Representative`, `Effective Date`, `Date`.  
  Company: `Company Full Name`, `Company Signature`.

Mark operator templates with recipient type **Operator** in the workspace
(or let DocuSeal sync infer it from names like “operator”, “contractor”, “VA”).

## Send behaviour

1. Generic alias mapping fills whatever it can from the recipient record.
2. For operator templates, the exact VA map overlays those values.
3. Values whose names are not on the current template revision are dropped
   (so a re-uploaded DocuSeal template cannot break every send).
4. A second submitter is added for the Company role with countersign fields
   pre-filled from Settings. The operator still signs their own signature slots.

## Settings to configure

- `company_name` — Divine Acquisition (default)
- `company_rep` — printed / signature name on the company page
- `company_email` — company submitter email (no email is sent to this role)
- `company_title` — e.g. Owner

Migration: `supabase/migrations/20260807150000_da_operator_company_settings.sql`.
