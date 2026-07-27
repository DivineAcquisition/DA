import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { ActionForm, Disclosure } from '@/app/ad/components/ActionForm';
import { revealCredentialAction, storeCredentialAction } from '@/lib/ad/actions';
import { listCaseFiles, listCredentials } from '@/lib/ad/queries';

export default async function CredentialsPage() {
  const [credentials, caseFiles] = await Promise.all([listCredentials(), listCaseFiles()]);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Vault</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Credentials</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Secrets live in Supabase Vault. Every reveal requires step-up and writes an audit row.
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold">Store a credential</h2>
        <ActionForm className="mt-4" action={storeCredentialAction} submitLabel="Store in vault">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Case file</label>
              <select name="case_file_id" required className={inputClass}>
                {caseFiles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Kind</label>
              <input name="kind" defaultValue="login" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Label</label>
              <input name="label" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Username</label>
              <input name="username" className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Secret</label>
              <input name="secret" type="password" required className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Confirm your password (step-up)</label>
              <input name="step_up_password" type="password" required className={inputClass} />
            </div>
          </div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Stored credentials</h2>
        <ul className="divide-y divide-white/[0.04] overflow-hidden rounded-2xl border border-white/[0.06]">
          {credentials.map((cred) => (
            <li key={cred.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-white">{cred.label}</p>
                <p className="text-xs text-neutral-500">
                  {cred.kind}
                  {cred.username ? ` · ${cred.username}` : ''}
                  {cred.stale ? ' · stale' : ''}
                  {cred.last_revealed_at
                    ? ` · last revealed ${new Date(cred.last_revealed_at).toLocaleString()}`
                    : ''}
                </p>
              </div>
              <Disclosure label="Reveal">
                <ActionForm
                  action={revealCredentialAction.bind(null, cred.id)}
                  submitLabel="Reveal (logged)"
                  variant="danger"
                >
                  <label className={labelClass}>Confirm password</label>
                  <input name="password" type="password" required className={inputClass} />
                </ActionForm>
              </Disclosure>
            </li>
          ))}
          {credentials.length === 0 && (
            <li className="px-4 py-8 text-center text-neutral-500">No credentials in scope.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
