'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aboutContent, getRole, type RoleDetail } from '../../data/roles';
import ApplicationForm from '../components/ApplicationForm';
import { ApplicantPath, HiringNow } from '../components/agentic';
import {
  CareersFooter,
  CareersHeader,
  CareersShell,
  GlowFrame,
  btnPrimary,
  btnSecondary,
  btnSm,
  eyebrow,
  gutter,
  heroTitle,
  panel,
  sectionTitle,
  shell,
  subhead,
} from '../components/careers-ui';

function ApplyPanel({ detail, title, slug }: { detail: RoleDetail; title: string; slug: string }) {
  return (
    <GlowFrame className="!p-0">
      <div className="flex items-center gap-3 border-b border-c-line px-5 py-4 sm:px-7">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-c-ink text-sm font-semibold text-white">2</span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium tracking-tight text-c-ink sm:text-lg">Apply for {title}</h2>
          <p className="text-xs text-c-muted">Complete the form below to submit your application</p>
        </div>
      </div>

      {detail.apply.kind === 'airtable' ? (
        <div>
          <div className="bg-c-soft p-3 sm:p-4">
            <iframe title={`Application form for ${title}`} className="h-[720px] w-full rounded-xl border border-c-line bg-white sm:h-[860px]" src={detail.apply.src} />
          </div>
          <p className="border-t border-c-line px-5 py-4 text-center text-xs text-c-muted sm:px-7">
            Form not loading?{' '}
            <a href={detail.apply.src.replace('/embed/', '/')} target="_blank" rel="noopener noreferrer" className="font-medium text-c-violet underline underline-offset-2">
              Open it in a new tab
            </a>
            .
          </p>
        </div>
      ) : detail.apply.kind === 'external' ? (
        <div className="px-6 py-12 text-center">
          <a href={detail.apply.href} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            Open application form
          </a>
        </div>
      ) : (
        <ApplicationForm roleSlug={slug} jobTitle={title} />
      )}
    </GlowFrame>
  );
}

export default function RolePage() {
  const params = useParams();
  const slug = params.slug as string;
  const role = getRole(slug);
  const detail = role?.detail;

  if (!role || !detail) {
    return (
      <CareersShell>
        <CareersHeader />
        <div className={cn(gutter, 'flex min-h-[60vh] items-center justify-center')}>
          <div className="text-center">
            <h1 className="text-2xl font-medium tracking-tight text-c-ink">Position not found</h1>
            <p className="mt-2 text-sm text-c-muted">This role may have been filled or moved.</p>
            <Link href="/hiring" className={cn(btnPrimary, 'mt-7')}>
              Back to all positions
            </Link>
          </div>
        </div>
        <CareersFooter />
      </CareersShell>
    );
  }

  const facts = [
    { label: 'Department', value: role.departmentLabel },
    { label: 'Location', value: role.tags[0] },
    { label: 'Type', value: detail.type },
    { label: 'Compensation', value: detail.compensation, accent: true },
  ];

  return (
    <CareersShell>
      <CareersHeader action={{ href: '#apply', label: 'Apply for this role' }} />

      {/* Hero */}
      <section className={cn(gutter, 'relative pb-14 pt-12 sm:pb-20 sm:pt-16')}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(60%_60%_at_30%_0%,rgba(154,136,252,0.14),transparent_70%)]" />
        <div className={cn(shell, 'relative')}>
          <Link href="/hiring#positions" className="inline-flex items-center gap-1.5 text-sm font-medium text-c-muted hover:text-c-ink">
            <ArrowLeft className="size-4" aria-hidden />
            All roles
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className={eyebrow}>{role.departmentLabel}</p>
            <HiringNow />
          </div>
          <h1 className={cn(heroTitle, 'mt-3 max-w-3xl')}>{role.title}</h1>
          <p className={cn(subhead, 'mt-5 max-w-2xl')}>{role.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#apply" className={btnPrimary}>
              Apply for this role
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a href="#after" className={btnSecondary}>
              What happens after you apply
            </a>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-c-line bg-c-line md:grid-cols-4">
            {facts.map((item) => (
              <div key={item.label} className="bg-white px-5 py-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-c-muted">{item.label}</dt>
                <dd className={cn('mt-1.5 text-sm font-medium', item.accent ? 'text-c-violet' : 'text-c-ink')}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Details beside a sticky summary */}
      <section className={cn(gutter, 'border-t border-c-line py-16 sm:py-20')}>
        <div className={cn(shell, 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14')}>
          <div className="min-w-0 space-y-12">
            <div>
              <p className={cn(eyebrow, 'mb-3')}>The mission</p>
              <p className="text-lg leading-relaxed tracking-tight text-c-ink sm:text-xl">{detail.mission}</p>
            </div>

            {detail.techStack ? (
              <div>
                <p className={cn(eyebrow, 'mb-3')}>Tech stack</p>
                <div className="flex flex-wrap gap-2">
                  {detail.techStack.map((tech) => (
                    <span key={tech} className="rounded-lg border border-[#d9d1fe] bg-[#f5f3ff] px-3 py-1.5 text-[13px] font-medium text-c-violet">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {detail.sections.map((section) => {
              const exclusion = section.title.includes('NOT');
              return (
                <div key={section.title}>
                  <h2 className="mb-4 text-xl font-medium tracking-tight text-c-ink">{section.title}</h2>
                  <ul className={cn(panel, 'divide-y divide-c-line')}>
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-3.5 px-5 py-3.5">
                        <span
                          className={cn(
                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                            exclusion ? 'border-c-line bg-c-soft text-c-muted' : 'border-[#d9d1fe] bg-[#f5f3ff] text-[#7e67f2]',
                          )}
                        >
                          {exclusion ? <X className="size-3" aria-hidden /> : <Check className="size-3" aria-hidden />}
                        </span>
                        <span className={cn('text-[15px] leading-relaxed', exclusion ? 'text-c-muted' : 'text-c-ink')}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            <div className="rounded-xl border border-c-line bg-c-soft p-6 sm:p-7">
              <p className={cn(eyebrow, 'mb-3')}>About Divine Acquisition</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-c-muted">{aboutContent}</p>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <GlowFrame>
              <p className={eyebrow}>{role.subtitle}</p>
              <p className="mt-1 text-xl font-medium tracking-tight text-c-ink">{role.title}</p>
              <dl className="mt-5 grid gap-3 text-sm">
                {facts.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-4 border-t border-c-line pt-3">
                    <dt className="text-c-muted">{item.label}</dt>
                    <dd className={cn('text-right font-medium', item.accent ? 'text-c-violet' : 'text-c-ink')}>{item.value}</dd>
                  </div>
                ))}
              </dl>
              <a href="#apply" className={cn(btnPrimary, 'mt-6 w-full')}>
                Apply now
              </a>
              <p className="mt-3 text-center text-xs text-c-muted">A person reads every application.</p>
            </GlowFrame>
          </aside>
        </div>
      </section>

      {/* After you apply */}
      <section id="after" className={cn(gutter, 'scroll-mt-24 border-t border-c-line py-16 sm:py-20')}>
        <div className={shell}>
          <p className={cn(eyebrow, 'mb-3')}>After you apply</p>
          <h2 className={sectionTitle}>What happens next.</h2>
          <ApplicantPath roleSlug={role.slug} className="mt-10" />
        </div>
      </section>

      {/* Apply */}
      <section id="apply" className={cn(gutter, 'scroll-mt-24 border-t border-c-line py-16 sm:py-20')}>
        <div className="mx-auto max-w-3xl">
          <ApplyPanel detail={detail} title={role.title} slug={role.slug} />
          <div className="mt-6 text-center">
            <Link href="/hiring#positions" className={cn(btnSecondary, btnSm)}>
              See all open roles
            </Link>
          </div>
        </div>
      </section>

      <CareersFooter />
    </CareersShell>
  );
}
