'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Backdrop from '../../components/Backdrop';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { aboutContent, getRole, type RoleDetail } from '../../data/roles';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm, sectionLabel } from '../../components/ui';

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="h-px w-6 bg-gradient-to-r from-brand-500 to-transparent" />
      <h2 className={sectionLabel}>{label}</h2>
    </div>
  );
}

function CheckBullet() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-brand-500/25 bg-brand-500/10 text-brand-300">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
      </svg>
    </span>
  );
}

function CrossBullet() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-neutral-500">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

function ApplicationForm({ jobTitle }: { jobTitle: string }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    linkedin: '',
    portfolio: '',
    loomVideo: '',
    experience: '',
    whyYou: '',
    availability: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  const field =
    'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none';
  const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

  if (submitted) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white">Application submitted</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          Thank you for applying for the {jobTitle} position. We&apos;ll review your application and get
          back to you within 5–7 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="fullName">
            Full name *
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={formData.fullName}
            onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
            className={field}
            placeholder="Jordan Rivera"
          />
        </div>
        <div>
          <label className={label} htmlFor="email">
            Email address *
          </label>
          <input
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(event) => setFormData({ ...formData, email: event.target.value })}
            className={field}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="phone">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
            className={field}
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div>
          <label className={label} htmlFor="linkedin">
            LinkedIn profile
          </label>
          <input
            id="linkedin"
            type="url"
            value={formData.linkedin}
            onChange={(event) => setFormData({ ...formData, linkedin: event.target.value })}
            className={field}
            placeholder="https://linkedin.com/in/username"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="portfolio">
          Portfolio / website
        </label>
        <input
          id="portfolio"
          type="url"
          value={formData.portfolio}
          onChange={(event) => setFormData({ ...formData, portfolio: event.target.value })}
          className={field}
          placeholder="https://yourportfolio.com"
        />
      </div>

      <div>
        <label className={label} htmlFor="loom">
          Loom video introduction
        </label>
        <input
          id="loom"
          type="url"
          value={formData.loomVideo}
          onChange={(event) => setFormData({ ...formData, loomVideo: event.target.value })}
          className={field}
          placeholder="https://www.loom.com/share/your-video-id"
        />
        <p className="mt-2 text-xs text-neutral-600">
          Record a 2–3 minute video introducing yourself and why this role interests you.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="experience">
          Relevant experience *
        </label>
        <textarea
          id="experience"
          required
          rows={4}
          value={formData.experience}
          onChange={(event) => setFormData({ ...formData, experience: event.target.value })}
          className={`${field} resize-none`}
          placeholder="Tell us about your relevant experience and accomplishments…"
        />
      </div>

      <div>
        <label className={label} htmlFor="whyYou">
          Why are you the right fit? *
        </label>
        <textarea
          id="whyYou"
          required
          rows={4}
          value={formData.whyYou}
          onChange={(event) => setFormData({ ...formData, whyYou: event.target.value })}
          className={`${field} resize-none`}
          placeholder="What makes you uniquely qualified for this role?"
        />
      </div>

      <div>
        <label className={label} htmlFor="availability">
          Availability *
        </label>
        <select
          id="availability"
          required
          value={formData.availability}
          onChange={(event) => setFormData({ ...formData, availability: event.target.value })}
          className={`${field} cursor-pointer appearance-none`}
        >
          <option value="">Select availability</option>
          <option value="immediate">Immediately</option>
          <option value="1-2weeks">1–2 weeks</option>
          <option value="2-4weeks">2–4 weeks</option>
          <option value="1month+">1 month+</option>
        </select>
      </div>

      <button type="submit" className={`${btnPrimary} ${btnSizeMd} w-full`}>
        Submit application
      </button>

      <p className="text-center text-xs text-neutral-600">
        By submitting, you agree to our privacy policy and consent to being contacted about this
        opportunity.
      </p>
    </form>
  );
}

function ApplyPanel({ detail, title }: { detail: RoleDetail; title: string }) {
  return (
    <section id="apply" className="scroll-mt-24">
      <div className="panel overflow-hidden rounded-3xl">
        <div className="relative flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-4 sm:px-7">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-ink-950">
            2
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white sm:text-lg">Apply for {title}</h2>
            <p className="text-xs text-neutral-500">Complete the form below to submit your application</p>
          </div>
        </div>

        {detail.apply.kind === 'airtable' ? (
          <div>
            {/* Airtable renders its form on a white page, so it is framed as a
                deliberate light sheet rather than fighting the dark surface. */}
            <div className="bg-white/[0.04] p-3 sm:p-4">
              <iframe
                title={`Application form for ${title}`}
                className="h-[720px] w-full rounded-2xl border-0 bg-white sm:h-[860px]"
                src={detail.apply.src}
              />
            </div>
            <p className="border-t border-white/[0.06] px-5 py-4 text-center text-xs text-neutral-500 sm:px-7">
              Form not loading?{' '}
              <a
                href={detail.apply.src.replace('/embed/', '/')}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-300 underline decoration-brand-500/40 underline-offset-2 hover:text-brand-200"
              >
                Open it in a new tab
              </a>
              .
            </p>
          </div>
        ) : detail.apply.kind === 'external' ? (
          <div className="px-6 py-12 text-center">
            <a href={detail.apply.href} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} ${btnSizeMd}`}>
              Open application form
            </a>
          </div>
        ) : (
          <ApplicationForm jobTitle={title} />
        )}
      </div>
    </section>
  );
}

export default function RolePage() {
  const params = useParams();
  const slug = params.slug as string;
  const role = getRole(slug);
  const detail = role?.detail;

  if (!role || !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-white">
        <Backdrop />
        <div className="relative z-10 text-center">
          <h1 className="text-2xl font-semibold">Position not found</h1>
          <p className="mt-2 text-sm text-neutral-500">
            This role may have been filled or moved.
          </p>
          <Link href="/hiring" className={`${btnPrimary} ${btnSizeMd} mt-7`}>
            Back to all positions
          </Link>
        </div>
      </div>
    );
  }

  const meta = [
    { label: 'Department', value: role.departmentLabel },
    { label: 'Location', value: role.tags[0] },
    { label: 'Type', value: detail.type },
    { label: 'Compensation', value: detail.compensation, accent: true },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <div className="relative z-10">
        <SiteHeader
          action={
            <>
              <Link href="/hiring" className={`${btnSecondary} ${btnSizeSm}`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0 5.5-5.5M5 12l5.5 5.5" />
                </svg>
                <span className="hidden sm:inline">All roles</span>
                <span className="sm:hidden">Back</span>
              </Link>
              <a href="#apply" className={`${btnPrimary} ${btnSizeSm}`}>
                Apply
              </a>
            </>
          }
        />

        <main className="px-5 pb-20 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl">
            {/* Hero */}
            <section className="mb-14">
              <div className="animate-rise flex items-center gap-3">
                <span className="h-px w-6 bg-gradient-to-r from-brand-500 to-transparent" />
                <span className={sectionLabel}>{role.departmentLabel}</span>
              </div>

              <h1 className="animate-rise delay-1 mt-5 text-[2.25rem] font-semibold leading-[1.05] sm:text-5xl md:text-6xl">
                {role.title}
              </h1>

              <p className="animate-rise delay-2 mt-6 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
                {role.description}
              </p>

              <dl className="animate-rise delay-3 mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.05] md:grid-cols-4">
                {meta.map((item) => (
                  <div key={item.label} className="bg-ink-950/85 px-4 py-4">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      {item.label}
                    </dt>
                    <dd
                      className={`mt-1.5 text-sm font-medium ${item.accent ? 'text-brand-300' : 'text-white'}`}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="animate-rise delay-4 mt-7">
                <a href="#apply" className={`${btnPrimary} ${btnSizeMd}`}>
                  Apply for this role
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
                  </svg>
                </a>
              </div>
            </section>

            {/* Mission */}
            <section className="mb-14">
              <SectionHeading label="The mission" />
              <p className="panel rounded-2xl p-6 text-base leading-relaxed text-neutral-300">
                {detail.mission}
              </p>
            </section>

            {/* Tech stack */}
            {detail.techStack && (
              <section className="mb-14">
                <SectionHeading label="Tech stack" />
                <div className="flex flex-wrap gap-2">
                  {detail.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-lg border border-brand-500/20 bg-brand-500/[0.08] px-3 py-1.5 text-[13px] font-medium text-brand-200"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Detail sections */}
            {detail.sections.map((section) => {
              const isExclusion = section.title.includes('NOT');
              return (
                <section key={section.title} className="mb-14">
                  <SectionHeading label={section.title} />
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-3.5">
                        {isExclusion ? <CrossBullet /> : <CheckBullet />}
                        <span
                          className={`text-[15px] leading-relaxed ${isExclusion ? 'text-neutral-500' : 'text-neutral-300'}`}
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {/* About */}
            <section className="mb-14">
              <div className="panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
                <div
                  aria-hidden
                  className="absolute -right-20 -top-20 h-56 w-56 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(154,136,252,0.18) 0%, transparent 70%)' }}
                />
                <div className="relative">
                  <SectionHeading label="About Divine Acquisition" />
                  <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-400">
                    {aboutContent}
                  </p>
                </div>
              </div>
            </section>

            <ApplyPanel detail={detail} title={role.title} />
          </div>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
