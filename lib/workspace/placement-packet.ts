/**
 * When a sales operator is placed, file their onboarding packet: a branded
 * PDF of the form, the signed agreement, a copy in the admin workspace, a
 * row on the Airtable VAs table, and the files in Google Drive when Drive
 * is connected.
 */

import { appUrl } from '@/lib/apps';
import { resolveAirtableApiKey } from '@/lib/acq/airtable-key';
import { driveConfigured, uploadFile } from '@/lib/drive/client';
import { fetchSubmissionDocuments } from '@/lib/workspace/docuseal';
import { serviceRoleClient, type UntypedClient } from '@/lib/workspace/db';
import { buildBrandedPdf } from './branded-pdf';
import { airtableOperatorFields, onboardingSections, type OnboardingAnswers } from './onboarding-packet';

export const VA_BASE_ID = process.env.AIRTABLE_VA_BASE_ID?.trim() || 'appoUuFQZQfCyKGlw';
export const VA_TABLE_ID = process.env.AIRTABLE_VA_TABLE_ID?.trim() || 'tblDGFTL6C9hRD6uO';
export const OPERATOR_PACKET_FOLDER_ID =
  process.env.GOOGLE_DRIVE_OPERATOR_FOLDER_ID?.trim() || '1B2HiseyWEIZ9FtqFJkrOZDvvb30PPofU';

type PacketRow = {
  id: string;
  operator_id: string;
  placement_id: string | null;
  status: string;
};

type OperatorRow = { id: string; name: string; email: string; profile_id: string | null };

export async function filePendingOperatorPackets(limit = 5): Promise<{ filed: number; failed: number }> {
  const client = serviceRoleClient();
  if (!client) return { filed: 0, failed: 0 };
  const { data } = await client
    .from('operator_packet')
    .select('id, operator_id, placement_id, status')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  let filed = 0;
  let failed = 0;
  for (const row of (data ?? []) as PacketRow[]) {
    const result = await fileOperatorPacket(client, row);
    if (result.ok) filed += 1;
    else failed += 1;
  }
  return { filed, failed };
}

async function fileOperatorPacket(client: UntypedClient, packet: PacketRow): Promise<{ ok: boolean }> {
  const { data: operator } = await client
    .from('operator')
    .select('id, name, email, profile_id')
    .eq('id', packet.operator_id)
    .maybeSingle();
  if (!operator) {
    await markFailed(client, packet.id, 'The operator no longer exists.');
    return { ok: false };
  }
  const person = operator as OperatorRow;

  const { data: submission } = await client
    .from('da_onboarding_submission')
    .select('answers, completed_at, protocol_key, da_recipient!inner(operator_id)')
    .eq('status', 'completed')
    .eq('da_recipient.operator_id', person.id)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const answers = ((submission as { answers?: OnboardingAnswers } | null)?.answers ?? {}) as OnboardingAnswers;
  const fields = airtableOperatorFields({ name: person.name, email: person.email, answers });
  const pdf = buildBrandedPdf({
    kicker: 'DIVINE ACQUISITION',
    title: fields.name,
    subtitle: 'Sales operator placement packet. Filed when this operator was placed.',
    sections: onboardingSections(answers),
  });

  const agreement = await loadSignedAgreement(client, person.id);
  const drive = await uploadPacket(fields.name, pdf, agreement);
  const airtableRecordId = await upsertVaRecord(fields, {
    onboardingUrl: drive.onboardingUrl,
    agreementUrl: drive.agreementUrl || agreement.url,
    folderUrl: drive.folderUrl,
    signed: Boolean(agreement.bytes || agreement.url),
    signedOn: agreement.completedOn,
    startDate: new Date().toISOString().slice(0, 10),
  });

  const { error } = await client
    .from('operator_packet')
    .update({
      status: 'filed',
      error: drive.error,
      onboarding_pdf_b64: Buffer.from(pdf).toString('base64'),
      agreement_pdf_b64: agreement.bytes ? Buffer.from(agreement.bytes).toString('base64') : null,
      agreement_filename: agreement.filename,
      drive_folder_url: drive.folderUrl,
      drive_onboarding_url: drive.onboardingUrl,
      drive_agreement_url: drive.agreementUrl,
      airtable_record_id: airtableRecordId,
      filed_at: new Date().toISOString(),
    })
    .eq('id', packet.id);
  if (error) {
    await markFailed(client, packet.id, error.message);
    return { ok: false };
  }
  return { ok: true };
}

async function markFailed(client: UntypedClient, id: string, error: string) {
  await client.from('operator_packet').update({ status: 'failed', error: error.slice(0, 500) }).eq('id', id);
}

async function loadSignedAgreement(
  client: UntypedClient,
  operatorId: string,
): Promise<{ bytes: Uint8Array | null; url: string | null; filename: string; completedOn: string | null }> {
  const { data } = await client
    .from('da_agreement')
    .select('signed_document_url, completed_at, docuseal_submission_id, da_recipient!inner(operator_id), da_agreement_template(name)')
    .eq('status', 'completed')
    .eq('da_recipient.operator_id', operatorId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as {
    signed_document_url?: string | null;
    completed_at?: string | null;
    docuseal_submission_id?: string | null;
    da_agreement_template?: { name?: string } | { name?: string }[] | null;
  } | null;
  const template = Array.isArray(row?.da_agreement_template) ? row?.da_agreement_template[0] : row?.da_agreement_template;
  const filename = `${(template?.name || 'Signed agreement').replace(/[^\w.\- ]+/g, '').trim() || 'Signed agreement'}.pdf`;
  let url = row?.signed_document_url ?? null;
  if (!url && row?.docuseal_submission_id) {
    const key = process.env.DOCUSEAL_API_KEY?.trim() || '';
    const [fresh] = key ? await fetchSubmissionDocuments(key, row.docuseal_submission_id).catch(() => []) : [];
    url = fresh?.url ?? null;
  }
  let bytes: Uint8Array | null = null;
  if (url) {
    const response = await fetch(url, { cache: 'no-store' }).catch(() => null);
    if (response?.ok) bytes = new Uint8Array(await response.arrayBuffer());
  }
  return { bytes, url, filename, completedOn: row?.completed_at?.slice(0, 10) ?? null };
}

async function uploadPacket(
  name: string,
  onboarding: Uint8Array,
  agreement: { bytes: Uint8Array | null; filename: string },
): Promise<{ folderUrl: string | null; onboardingUrl: string | null; agreementUrl: string | null; error: string | null }> {
  if (!driveConfigured()) {
    return { folderUrl: null, onboardingUrl: null, agreementUrl: null, error: null };
  }
  try {
    const safe = name.replace(/[^\w.\- ]+/g, '').trim() || 'Operator';
    const onboardingFile = await uploadFile(
      OPERATOR_PACKET_FOLDER_ID,
      `${safe} - onboarding.pdf`,
      'application/pdf',
      onboarding.buffer.slice(onboarding.byteOffset, onboarding.byteOffset + onboarding.byteLength) as ArrayBuffer,
    );
    let agreementUrl: string | null = null;
    if (agreement.bytes) {
      const signed = await uploadFile(
        OPERATOR_PACKET_FOLDER_ID,
        `${safe} - ${agreement.filename}`,
        'application/pdf',
        agreement.bytes.buffer.slice(agreement.bytes.byteOffset, agreement.bytes.byteOffset + agreement.bytes.byteLength) as ArrayBuffer,
      );
      agreementUrl = signed.webViewLink;
    }
    return {
      folderUrl: `https://drive.google.com/drive/folders/${OPERATOR_PACKET_FOLDER_ID}`,
      onboardingUrl: onboardingFile.webViewLink,
      agreementUrl,
      error: null,
    };
  } catch (error) {
    return {
      folderUrl: null,
      onboardingUrl: null,
      agreementUrl: null,
      error: error instanceof Error ? error.message : 'Drive upload failed.',
    };
  }
}

async function upsertVaRecord(
  fields: ReturnType<typeof airtableOperatorFields>,
  links: {
    onboardingUrl: string | null;
    agreementUrl: string | null;
    folderUrl: string | null;
    signed: boolean;
    signedOn: string | null;
    startDate: string;
  },
): Promise<string | null> {
  const key = await resolveAirtableApiKey();
  if (!key) return null;
  const recordFields: Record<string, unknown> = {
    Name: fields.name,
    Email: fields.email,
    Role: 'Sales',
    Status: 'Approved',
    'Agreement Signed': links.signed,
    'Start Date': links.startDate,
    Notes: fields.notes,
  };
  if (fields.phone) recordFields.Phone = fields.phone;
  if (fields.timezone) recordFields.Timezone = fields.timezone;
  if (fields.shift) recordFields.Shift = fields.shift;
  if (fields.discord) recordFields.Discord = fields.discord;
  if (fields.city) recordFields.City = fields.city;
  if (links.signedOn) recordFields['Agreement Signed Date'] = links.signedOn;
  const adminBase = appUrl('admin');
  if (links.onboardingUrl) recordFields['Onboarding PDF'] = links.onboardingUrl;
  else if (adminBase) recordFields['Onboarding PDF'] = `${adminBase}/workspace/onboarding`;
  if (links.agreementUrl) recordFields['Signed agreement'] = links.agreementUrl;
  if (links.folderUrl) recordFields['Drive folder'] = links.folderUrl;

  const formula = `LOWER({Email})="${fields.email.replace(/"/g, '').toLowerCase()}"`;
  const listed = await airtable<{ records?: { id: string }[] }>(
    key,
    `?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`,
    { method: 'GET' },
  );
  const existing = listed?.records?.[0]?.id;
  if (existing) {
    await airtable(key, `/${existing}`, { method: 'PATCH', body: JSON.stringify({ fields: recordFields }) });
    return existing;
  }
  const created = await airtable<{ id?: string }>(key, '', {
    method: 'POST',
    body: JSON.stringify({ fields: recordFields }),
  });
  return created?.id ?? null;
}

async function airtable<T>(key: string, path: string, init: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`https://api.airtable.com/v0/${VA_BASE_ID}/${VA_TABLE_ID}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
