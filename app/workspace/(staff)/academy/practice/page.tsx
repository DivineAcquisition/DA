import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { savePracticeSettings } from '@/lib/academy/practiceAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input } from '../../components/ui';

type Settings = {
  sim_max_attempts?: number;
  sim_lockout_minutes?: number;
  sim_abandoned_minutes?: number;
  sim_daily_limit?: number;
  sim_pass_score?: number;
  capstone_pass_score?: number;
  capstone_compliance_min?: number;
  reflection_max_attempts?: number;
  reflection_min_words?: number;
  practical_max_submissions?: number;
  drill_questions?: number;
  drill_pass_mark?: number;
  drill_max_attempts?: number;
  drill_lockout_minutes?: number;
  ai_input_usd_per_million?: number;
  ai_output_usd_per_million?: number;
  speed_thresholds?: Record<string, number>;
};

export const metadata = { title: 'Practice settings' };

export default async function PracticeSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<{ settings?: Settings }>(supabase, 'academy_practice_catalog');
  const settings = data?.settings ?? {};
  const speed = settings.speed_thresholds ?? {};
  const fields: [string, string, number | undefined][] = [
    ['sim_max_attempts', 'Simulation attempts', settings.sim_max_attempts],
    ['sim_lockout_minutes', 'Simulation lockout minutes', settings.sim_lockout_minutes],
    ['sim_abandoned_minutes', 'Abandoned session minutes', settings.sim_abandoned_minutes],
    ['sim_daily_limit', 'Daily simulation sessions', settings.sim_daily_limit],
    ['sim_pass_score', 'Simulation pass score', settings.sim_pass_score],
    ['capstone_pass_score', 'Capstone pass score', settings.capstone_pass_score],
    ['capstone_compliance_min', 'Capstone compliance minimum', settings.capstone_compliance_min],
    ['reflection_max_attempts', 'Reflection attempts', settings.reflection_max_attempts],
    ['reflection_min_words', 'Reflection minimum words', settings.reflection_min_words],
    ['practical_max_submissions', 'Practical submissions', settings.practical_max_submissions],
    ['drill_questions', 'Signal Reading items', settings.drill_questions],
    ['drill_pass_mark', 'Signal Reading pass mark', settings.drill_pass_mark],
    ['drill_max_attempts', 'Signal Reading attempts', settings.drill_max_attempts],
    ['drill_lockout_minutes', 'Signal Reading lockout minutes', settings.drill_lockout_minutes],
    ['ai_input_usd_per_million', 'AI input USD per million tokens', settings.ai_input_usd_per_million],
    ['ai_output_usd_per_million', 'AI output USD per million tokens', settings.ai_output_usd_per_million],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Practice settings</h1>
        <Link href="/workspace/academy/simulations" className="text-sm text-neutral-300">Simulations</Link>
      </div>
      <p className="text-sm text-neutral-400">Speed scores use seconds from the lead&apos;s first message to the operator&apos;s first reply. A score is the first band whose limit is at least that many seconds.</p>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <form action={savePracticeSettings} className="grid gap-3 sm:grid-cols-2">
        {fields.map(([name, label, value]) => (
          <Field key={name} label={label}><Input name={name} type="number" step="any" defaultValue={value ?? ''} /></Field>
        ))}
        {['5', '4', '3', '2', '1'].map((score) => (
          <Field key={score} label={`Speed ${score} within seconds`}>
            <Input name={`speed_${score}`} type="number" defaultValue={speed[score] ?? ''} />
          </Field>
        ))}
        <Button type="submit" className="sm:col-span-2 sm:w-fit">Save settings</Button>
      </form>
    </div>
  );
}
