-- A VA can submit a tax document from the portal (Section 2.6). Until now the
-- only states were missing, requested, on_file and expired, so "sent, waiting
-- for DA to review" had nowhere to live. On its own migration because a new enum
-- value cannot be used in the transaction that adds it.
alter type public.tax_doc_status add value if not exists 'submitted' before 'on_file';
