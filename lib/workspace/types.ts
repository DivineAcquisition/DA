export type RecipientType = 'client' | 'operator';
export type RecipientStatus = 'active' | 'inactive';
export type AgreementStatus = 'sent' | 'viewed' | 'completed' | 'declined' | 'expired';

export type DaRecipient = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  recipient_type: RecipientType;
  business_name: string | null;
  status: RecipientStatus;
  notes: string | null;
  created_at: string;
};

export type DaPageTemplate = {
  id: string;
  name: string;
  title: string;
  body_markdown: string;
  variables: string[];
  created_at: string;
};

export type DocuSealFieldDefinition = {
  uuid?: string;
  name: string;
  type?: string;
  required?: boolean;
  submitter_uuid?: string;
};

export type DaAgreementTemplate = {
  id: string;
  name: string;
  description: string;
  recipient_type: RecipientType;
  docuseal_template_id: string;
  docuseal_slug: string | null;
  docuseal_folder: string | null;
  docuseal_fields: DocuSealFieldDefinition[];
  docuseal_submitters: { name?: string; uuid?: string }[];
  archived: boolean;
  synced_at: string | null;
  created_at: string;
};

export type DaAgreementTemplatePage = {
  id: string;
  agreement_template_id: string;
  page_template_id: string;
  docuseal_field_name: string;
  sort_order: number;
};

export type AgreementSource = 'workspace' | 'docuseal';

export type DaAgreement = {
  id: string;
  recipient_id: string;
  template_id: string;
  docuseal_submission_id: string | null;
  docuseal_submitter_id: string | null;
  docuseal_slug: string | null;
  submitter_email: string | null;
  signing_url: string | null;
  status: AgreementStatus;
  source: AgreementSource;
  sent_at: string;
  viewed_at: string | null;
  completed_at: string | null;
  signed_document_url: string | null;
  audit_log_url: string | null;
  prefilled_values: Record<string, string>;
  submitted_values: Record<string, string>;
  unmapped_fields: string[];
  superseded_by_id: string | null;
  synced_at: string | null;
  created_at: string;
};

export type DaRecipientField = {
  id: string;
  recipient_id: string;
  field_name: string;
  field_key: string;
  value: string;
  source: 'docuseal' | 'manual';
  agreement_id: string | null;
  observed_at: string;
};

export type DaFieldMapping = {
  id: string;
  agreement_template_id: string | null;
  field_name: string;
  field_key: string;
  source_key: string;
  literal_value: string | null;
  updated_at: string;
  created_at: string;
};

export type DaSyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  templates_synced: number;
  submissions_synced: number;
  recipients_created: number;
  values_captured: number;
  ok: boolean;
  error: string | null;
};

export type DaPageToken = {
  id: string;
  page_template_id: string;
  recipient_id: string;
  agreement_id: string | null;
  token: string;
  resolved_values: Record<string, string>;
  expires_at: string | null;
  revoked: boolean;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
};

export type DaCalendarLink = {
  id: string;
  name: string;
  destination_url: string;
  recipient_id: string;
  token: string;
  expires_at: string | null;
  revoked: boolean;
  click_count: number;
  first_clicked_at: string | null;
  last_clicked_at: string | null;
  created_at: string;
};

export type DaSettings = {
  id: number;
  docuseal_api_key: string;
  docuseal_account_id: string;
  docuseal_webhook_secret: string;
  default_booking_url: string;
  public_base_url: string;
  auto_prefill: boolean;
  prefill_readonly: boolean;
  /** Countersign identity for VA / operator agreements (Novara-style). */
  company_name: string;
  company_rep: string;
  company_email: string;
  company_title: string;
  last_synced_at: string | null;
  updated_at: string;
};

export type ActionResult =
  | { ok: true; message: string; data?: Record<string, unknown> }
  | { ok: false; error: string };
