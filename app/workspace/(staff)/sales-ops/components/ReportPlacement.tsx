import { saveReportConfigAction, saveReportSecretAction, testReportAction } from '@/lib/sales-reports/actions';
import ActionForm from './ActionForm';

type Contact = { email: string; name: string | null; source: string };
type Panel = {
  contacts: Contact[];
  weekly_enabled: boolean;
  daily_enabled: boolean;
  send_dow: number | null;
  send_time: string | null;
  require_approval: boolean;
  include_speed: boolean;
  include_plan: boolean;
  include_results: boolean | null;
  cc_manager: boolean;
  recipient_emails: string[];
  extra_emails: string[];
  extra_cc: string[];
  tracks_results: boolean;
  time_zone: string;
  discord_set: boolean;
  discord_last4: string | null;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ReportPlacement({ placementId, panel }: { placementId: string; panel: Panel | null }) {
  if (!panel) return <p className="text-sm text-[var(--ws-dim)]">Client reporting could not load.</p>;
  const selected = new Set(panel.recipient_emails ?? []);
  return (
    <div className="space-y-6">
      <ActionForm action={saveReportConfigAction} submitLabel="Save client reporting">
        <input type="hidden" name="placement_id" value={placementId} />
        <p className="text-sm text-[var(--ws-dim)]">Times use {panel.time_zone}. Blank day and time follow the workspace default, Monday at 9:00.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="weekly_enabled" defaultChecked={panel.weekly_enabled} /> Weekly report</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="daily_enabled" defaultChecked={panel.daily_enabled} /> Daily report after each submitted EOD</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="require_approval" defaultChecked={panel.require_approval} /> Require manager approval before sending</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cc_manager" defaultChecked={panel.cc_manager} /> CC the assigned manager</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="include_speed" defaultChecked={panel.include_speed} /> Include speed-to-lead</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="include_plan" defaultChecked={panel.include_plan} /> Include tomorrow&apos;s plan</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="include_results" defaultChecked={panel.tracks_results && panel.include_results !== false} /> Include show rate and closes</label>
        <label className="block text-sm">Send day
          <select name="send_dow" defaultValue={panel.send_dow ?? ''} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2">
            <option value="">Workspace default</option>
            {DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
          </select>
        </label>
        <label className="block text-sm">Send time
          <input name="send_time" defaultValue={panel.send_time ?? ''} placeholder="09:00" className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2" />
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend>Recipients on file</legend>
          {(panel.contacts ?? []).length === 0 ? <p className="text-[var(--ws-dim)]">No contact email on this client yet.</p> : null}
          {(panel.contacts ?? []).map((contact) => (
            <label key={contact.email} className="flex items-center gap-2">
              <input type="checkbox" name="recipient" value={contact.email} defaultChecked={selected.has(contact.email)} />
              <span>{contact.name ? `${contact.name} · ` : ''}{contact.email}</span>
            </label>
          ))}
        </fieldset>
        <label className="block text-sm">Extra recipient emails
          <input name="extra_emails" defaultValue={(panel.extra_emails ?? []).join(', ')} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2" />
        </label>
        <label className="block text-sm">Extra CC
          <input name="extra_cc" defaultValue={(panel.extra_cc ?? []).join(', ')} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2" />
        </label>
      </ActionForm>
      <ActionForm action={testReportAction} submitLabel="Send test report to me">
        <input type="hidden" name="placement_id" value={placementId} />
        <p className="text-sm text-[var(--ws-dim)]">Goes only to you, marked TEST, with no client link.</p>
      </ActionForm>
      <ActionForm action={saveReportSecretAction} submitLabel="Save client Discord webhook">
        <input type="hidden" name="kind" value="placement_discord" />
        <input type="hidden" name="placement_id" value={placementId} />
        <label className="block text-sm">Optional client channel webhook
          <input name="secret" type="password" autoComplete="off" placeholder={panel.discord_set ? `Stored ····${panel.discord_last4}` : 'https://discord.com/api/webhooks/…'} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2" />
        </label>
      </ActionForm>
    </div>
  );
}
