'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Play } from 'lucide-react';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { cn } from '@/lib/utils';
import {
  SDR_MONTHLY_BASE,
  departments,
  levelLabels,
  locations,
  roleHref,
  roles,
  type DepartmentId,
  type LocationId,
  type Role,
} from '../data/roles';
import { ApplicantPath, HiringDeskFrame, HiringFlow, HiringNow } from './components/agentic';
import {
  CareersFooter,
  CareersHeader,
  CareersShell,
  FaqList,
  GlowFrame,
  Section,
  btnPrimary,
  btnSecondary,
  btnSm,
  displayTitle,
  eyebrow,
  gutter,
  lead,
  panel,
  sectionTitle,
  shell,
  subhead,
  type Faq,
} from './components/careers-ui';

const values = [
  { name: 'Devotion', detail: 'Trust deep enough to become conviction.' },
  { name: 'Value', detail: 'Make the right path the easy path.' },
  { name: 'Exclusivity', detail: 'Transformation, never quick fixes.' },
];

const faqs: Faq[] = [
  {
    q: 'How do I apply?',
    a: 'Open a role and send the form at the bottom of its page. Every application goes to one inbox, and a person reads it.',
  },
  {
    q: 'What happens after I apply?',
    a: 'A person reads your application. If we move you forward, you get an email to set up your account and your operator file opens. For Sales Operator roles, onboarding and the Academy come next, before any live client work.',
  },
  {
    q: 'Do I need sales experience for the SDR Placement role?',
    a: 'No. You are trained before you touch a live conversation, and certified before you are placed inside a business.',
  },
  {
    q: 'How is the SDR Placement role paid?',
    a: `${SDR_MONTHLY_BASE.replace('–', ' to ')} a month base, plus commission on every appointment you book, paid twice a month.`,
  },
  {
    q: 'Is the work remote?',
    a: 'Most roles are remote. Core hours follow Eastern time (EST). Each role lists where it can be done.',
  },
  {
    q: 'When will I hear back?',
    a: 'We aim to reply within 5–7 business days of your application.',
  },
];

function LevelMeter({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-2" title={`${levelLabels[level]} level`}>
      <span className="flex items-end gap-[3px]" aria-hidden>
        {[1, 2, 3, 4].map((step) => (
          <span key={step} style={{ height: `${5 + step * 2.5}px` }} className={cn('w-[3px] rounded-full', step <= level ? 'bg-[#7e67f2]' : 'bg-white/15')} />
        ))}
      </span>
      <span className="text-xs text-c-muted">{levelLabels[level]}</span>
    </span>
  );
}

function FeaturedRoleCard({ role }: { role: Role }) {
  return (
    <Link href={roleHref(role)} className="group block">
      <GlowFrame className="!p-0 transition-transform group-hover:-translate-y-0.5">
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#9a88fc] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:#0b0a11]">
              <Play className="size-3 fill-current" aria-hidden />
              Watch first
            </span>
            <span className="rounded-full border border-c-line bg-c-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-c-muted">{role.subtitle}</span>
            <HiringNow />
          </div>
          <h3 className="mt-4 text-xl font-medium tracking-tight text-c-ink sm:text-2xl">{role.title}</h3>
          <p className="mt-2 max-w-2xl text-[length:15px] leading-relaxed text-c-muted">{role.summary}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-c-muted">
            {role.detail?.compensationHeadline ? (
              <span className="font-semibold text-c-violet">{role.detail.compensationHeadline}/mo base + commission</span>
            ) : null}
            {role.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-white/25" />
                {tag}
              </span>
            ))}
          </div>
          <span className={cn(btnPrimary, btnSm, 'mt-6')}>
            Watch the walkthrough
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </GlowFrame>
    </Link>
  );
}

function RoleCard({ role }: { role: Role }) {
  return (
    <Link href={roleHref(role)} className="group block">
      <article className={cn(panel, 'p-5 transition-[border-color,box-shadow,transform] group-hover:-translate-y-0.5 group-hover:border-[#9a88fc]/60 sm:p-6')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <h3 className="text-base font-medium tracking-tight text-c-ink sm:text-[17px]">{role.title}</h3>
              <span className="rounded-full border border-c-tint-line bg-c-tint px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-c-violet">{role.subtitle}</span>
              <HiringNow />
            </div>
            <p className="mb-3.5 text-sm leading-relaxed text-c-muted">{role.summary}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-c-muted">
              {role.tags.map((tag, index) => (
                <span key={tag} className="flex items-center gap-1.5">
                  {index === 0 ? <MapPin className="size-3.5" aria-hidden /> : <span className="size-1 rounded-full bg-white/25" />}
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
            <LevelMeter level={role.level} />
            <span className="flex size-9 items-center justify-center rounded-full border border-c-line bg-c-card text-c-muted transition-colors group-hover:border-[#7e67f2] group-hover:bg-[#9a88fc] group-hover:text-[color:#0b0a11]">
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function HiringPage() {
  const [selectedDept, setSelectedDept] = useState<DepartmentId | 'all'>('all');
  const [selectedLocations, setSelectedLocations] = useState<LocationId[]>(['remote', 'us-md']);
  const [sortBy, setSortBy] = useState('level-high');

  const toggleLocation = (locationId: LocationId) =>
    setSelectedLocations((previous) => (previous.includes(locationId) ? previous.filter((id) => id !== locationId) : [...previous, locationId]));

  const deptCounts = useMemo(
    () =>
      roles.reduce<Record<string, number>>((acc, role) => {
        acc[role.department] = (acc[role.department] || 0) + 1;
        return acc;
      }, {}),
    [],
  );

  const filteredRoles = useMemo(() => {
    const matches = roles.filter((role) => {
      if (selectedDept !== 'all' && role.department !== selectedDept) return false;
      return role.locations.some((location) => selectedLocations.includes(location));
    });
    return [...matches].sort((a, b) => (sortBy === 'level-low' ? a.level - b.level : b.level - a.level));
  }, [selectedDept, selectedLocations, sortBy]);

  const featured = filteredRoles.find((role) => role.featured);
  const standard = filteredRoles.filter((role) => role !== featured);
  const remoteShare = Math.round((roles.filter((role) => role.locations.includes('remote')).length / roles.length) * 100);
  const departmentCount = new Set(roles.map((role) => role.department)).size;

  return (
    <CareersShell>
      <CareersHeader />

      {/* Hero */}
      <section className={cn(gutter, 'relative pb-16 pt-14 sm:pb-24 sm:pt-20')}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_70%_0%,rgba(154,136,252,0.26),transparent_70%)]" />
        <div className={cn(shell, 'relative grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]')}>
          <div className="pt-4">
            <p className={cn(eyebrow, 'mb-4')}>Divine Acquisition careers</p>
            <h1 className={displayTitle}>Curating the engine to create trust, revenue &amp; retention.</h1>
            <p className={cn(subhead, 'mt-6 max-w-xl')}>
              We are building infrastructure that compounds trust, revenue &amp; retention for service based businesses. We are looking for those devoted to
              building DivineAcquisition™ &amp; our future projects.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#positions" className={btnPrimary}>
                Browse open roles
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <Link href="/hiring/sdr-placement" className={btnSecondary}>
                <Play className="size-3.5 fill-[#7e67f2] text-[#7e67f2]" aria-hidden />
                Watch the SDR walkthrough
              </Link>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-c-muted">Remote-first. Core hours on Eastern time. Every application is read by a person.</p>
          </div>
          <HiringDeskFrame roles={[...roles].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))} />
        </div>
      </section>

      <HiringFlow />

      {/* Positions */}
      <section id="positions" className={cn(gutter, 'scroll-mt-24 py-20 sm:py-28')}>
        <div className={shell}>
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={cn(eyebrow, 'mb-3')}>Open positions</p>
              <h2 className={sectionTitle}>Find where you fit.</h2>
            </div>
            <p className="text-sm text-c-muted">
              Showing <span className="font-semibold text-c-ink">{filteredRoles.length}</span> of {roles.length} roles
            </p>
          </div>

          {/* Department tabs: Vistrial's segmented switcher */}
          <div role="tablist" aria-label="Department" className="mb-4 flex gap-1 overflow-x-auto rounded-[10px] border border-c-line bg-c-soft p-1">
            {departments.map((dept) => {
              const active = selectedDept === dept.id;
              const count = dept.id === 'all' ? roles.length : (deptCounts[dept.id] ?? 0);
              return (
                <button
                  key={dept.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedDept(dept.id)}
                  className={cn(
                    'flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-c-card text-c-ink shadow-[0_1px_2px_rgba(0,0,0,0.5)]' : 'text-c-muted hover:text-c-ink',
                  )}
                >
                  {dept.name}
                  <span className="text-xs tabular-nums text-c-muted">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {locations.map((location) => {
                const on = selectedLocations.includes(location.id);
                return (
                  <button
                    key={location.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLocation(location.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                      on ? 'border-c-tint-line bg-c-tint text-c-ink' : 'border-c-line bg-c-card text-c-muted hover:text-c-ink',
                    )}
                  >
                    <span aria-hidden className={cn('size-1.5 rounded-full', on ? 'bg-[#7e67f2]' : 'bg-white/25')} />
                    {location.name}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm text-c-muted">
              Sort
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-9 rounded-lg border border-c-line bg-c-card px-3 text-sm text-c-ink outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc]/50"
              >
                <option value="level-high">Seniority: high to low</option>
                <option value="level-low">Seniority: low to high</option>
              </select>
            </label>
          </div>

          <div className="space-y-3.5">
            {featured ? <FeaturedRoleCard role={featured} /> : null}
            {standard.map((role) => (
              <RoleCard key={role.slug} role={role} />
            ))}
            {filteredRoles.length === 0 ? (
              <div className={cn(panel, 'px-6 py-16 text-center')}>
                <p className="text-c-muted">No positions match these filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept('all');
                    setSelectedLocations(['remote', 'us-md']);
                  }}
                  className={cn(btnSecondary, btnSm, 'mt-5')}
                >
                  Reset filters
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <Section
        id="how"
        eyebrow="How hiring works"
        headline="Applied, read, invited, trained, placed."
        lead="Every Sales Operator moves through the same order. A person reads your application, and nothing reaches a client until you are trained."
      >
        <ApplicantPath roleSlug="setter" />
      </Section>

      <Section headline="What we hold ourselves to." lead="Three values, and the numbers behind the team today.">
        <div className="grid gap-4 md:grid-cols-3">
          {values.map((value, index) => (
            <MagicCard key={value.name} gradientColor="rgba(154,136,252,0.14)" gradientFrom="#c3b6fe" gradientTo="#9a88fc" className={cn(panel, 'p-6')}>
              <span className="text-sm tabular-nums text-c-violet">{String(index + 1).padStart(2, '0')}</span>
              <p className="mt-3 text-xl font-medium tracking-tight text-c-ink">{value.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-c-muted">{value.detail}</p>
            </MagicCard>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-c-line bg-c-line gap-px sm:grid-cols-4">
          {[
            { label: 'Open roles', value: <NumberTicker value={roles.length} className="tracking-normal text-c-ink" /> },
            { label: 'Remote-first', value: <><NumberTicker value={remoteShare} className="tracking-normal text-c-ink" />%</> },
            { label: 'Departments', value: <NumberTicker value={departmentCount} className="tracking-normal text-c-ink" /> },
            { label: 'Core time zone', value: 'EST' },
          ].map((stat) => (
            <div key={stat.label} className="bg-c-card px-5 py-6">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-c-muted">{stat.label}</dt>
              <dd className="mt-2 text-3xl font-medium tabular-nums tracking-tight text-c-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="faq" headline="Frequently asked questions">
        <FaqList items={faqs} />
      </Section>

      <section className={cn(gutter, 'border-t border-c-line py-20 sm:py-28')}>
        <div className={shell}>
          <GlowFrame beamDelay={1.4} className="mx-auto max-w-3xl text-center">
            <h2 className={cn(sectionTitle, 'mx-auto text-center')}>Find your seat. We read every application.</h2>
            <p className={cn(lead, 'mx-auto mt-4 text-center')}>Pick the role that fits, send the form, and a person will read it.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#positions" className={btnPrimary}>
                Browse open roles
              </a>
              <Link href="/hiring/sdr-placement" className={btnSecondary}>
                See the SDR Placement role
              </Link>
            </div>
          </GlowFrame>
        </div>
      </section>

      <CareersFooter />
    </CareersShell>
  );
}
