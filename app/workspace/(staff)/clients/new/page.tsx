import type { Metadata } from 'next';
import Link from 'next/link';
import { establishAccountAction } from '@/lib/clients/actions';
import { getProspectForAccount } from '@/lib/clients/desk';
import { listIndustryTemplates } from '@/lib/da/queries';
import DeskForm from '../../components/DeskForm';
import { DeskHeader, Section, area, field, primary } from '../../components/desk';

export const metadata: Metadata = { title: 'Establish account' };
export const dynamic = 'force-dynamic';

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm text-neutral-300">
      {children}
    </label>
  );
}

/**
 * Establish account. A prospect becomes a client case file with the fields
 * the Growth form always asked for: name, vertical, industry template, and
 * the main contact.
 */
export default async function EstablishAccountPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead: leadId } = await searchParams;
  const [templates, lead] = await Promise.all([listIndustryTemplates(), leadId ? getProspectForAccount(leadId) : Promise.resolve(null)]);
  const existing = typeof lead?.payload?.case_file_id === 'string' ? lead.payload.case_file_id : null;
  const spend = lead?.monthly_ad_spend == null ? '' : String(lead.monthly_ad_spend);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={lead ? `/workspace/clients/prospects/${lead.id}` : '/workspace/clients/prospects'} className="text-sm text-neutral-400 hover:text-white">
        {lead ? 'Back to the prospect' : 'Prospects'}
      </Link>
      <DeskHeader
        title="Establish account"
        description="Creates the client case file. The industry template decides the shift questions every operator on this client answers, and seeds the qualified-booking definition."
      />
      {existing ? (
        <p className="panel rounded-2xl px-5 py-4 text-sm text-neutral-300">
          This prospect already has a{' '}
          <Link href={`/workspace/clients/${existing}`} className="text-brand-200 hover:text-white">
            case file
          </Link>
          .
        </p>
      ) : null}
      <Section title={lead ? `From ${lead.full_name ?? lead.email ?? 'the prospect'}` : 'Client'}>
        <DeskForm action={establishAccountAction} className="grid gap-4">
          {lead ? <input type="hidden" name="lead_id" value={lead.id} /> : null}
          <div className="grid gap-1">
            <Label htmlFor="name">Client name</Label>
            <input id="name" name="name" required defaultValue={lead?.company_name ?? lead?.full_name ?? ''} className={field} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="vertical">Vertical</Label>
              <input id="vertical" name="vertical" defaultValue={lead?.coaching_niche ?? ''} className={field} placeholder="Med spa, three locations" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="industry_key">Industry template</Label>
              <select id="industry_key" name="industry_key" defaultValue="generic" className={field}>
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="contact_name">Main contact</Label>
              <input id="contact_name" name="contact_name" defaultValue={lead?.full_name ?? ''} className={field} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="contact_email">Contact email</Label>
              <input id="contact_email" name="contact_email" type="email" defaultValue={lead?.email ?? ''} className={field} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="contact_role">Their role</Label>
              <input id="contact_role" name="contact_role" className={field} placeholder="Owner" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="phone">Phone</Label>
              <input id="phone" name="phone" defaultValue={lead?.phone ?? ''} className={field} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="monthly_ad_spend">Monthly ad spend</Label>
              <input id="monthly_ad_spend" name="monthly_ad_spend" type="number" min="0" step="0.01" defaultValue={spend} className={field} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="engagement_start">Engagement start</Label>
              <input id="engagement_start" name="engagement_start" type="date" className={field} />
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="offer">Offer</Label>
            <textarea id="offer" name="offer" className={area} placeholder="What this engagement installs." />
          </div>
          <button type="submit" className={`${primary} justify-self-start`}>
            Establish account
          </button>
        </DeskForm>
      </Section>
    </div>
  );
}
