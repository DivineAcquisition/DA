'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Backdrop from '../components/Backdrop';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import {
  departments,
  levelLabels,
  locations,
  roleHref,
  roles,
  type DepartmentId,
  type LocationId,
  type Role,
} from '../data/roles';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm, eyebrow, sectionLabel } from '../components/ui';

const values = [
  { name: 'Devotion', detail: 'Trust deep enough to become conviction.' },
  { name: 'Value', detail: 'Make the right path the easy path.' },
  { name: 'Exclusivity', detail: 'Transformation, never quick fixes.' },
];

function LevelMeter({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-2" title={`${levelLabels[level]} level`}>
      <span className="flex items-end gap-[3px]">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            style={{ height: `${5 + step * 2.5}px` }}
            className={`w-[3px] rounded-full ${step <= level ? 'bg-brand-500' : 'bg-white/12'}`}
          />
        ))}
      </span>
      <span className="text-xs text-neutral-500">{levelLabels[level]}</span>
    </span>
  );
}

function PinIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

function FeaturedRoleCard({ role }: { role: Role }) {
  return (
    <Link href={roleHref(role)} className="group block">
      <article className="panel panel-hover relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: 'radial-gradient(circle, rgba(154,136,252,0.30) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-950">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.14v14l11-7-11-7Z" />
              </svg>
              Watch first
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300">
              {role.subtitle}
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-white transition-colors group-hover:text-brand-200 sm:text-2xl">
            {role.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">{role.summary}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
            <span className="font-semibold text-brand-300">$400–$600/mo base + commission</span>
            {role.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-neutral-700" />
                {tag}
              </span>
            ))}
          </div>

          <span className={`${btnPrimary} ${btnSizeSm} mt-6`}>
            Watch the walkthrough
            <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </article>
    </Link>
  );
}

function RoleCard({ role }: { role: Role }) {
  return (
    <Link href={roleHref(role)} className="group block">
      <article className="panel panel-hover rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <h3 className="text-base font-semibold text-white transition-colors group-hover:text-brand-200 sm:text-[17px]">
                {role.title}
              </h3>
              <span className="rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-300">
                {role.subtitle}
              </span>
            </div>

            <p className="mb-3.5 text-sm leading-relaxed text-neutral-400">{role.summary}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-500">
              {role.tags.map((tag, index) => (
                <span key={tag} className="flex items-center gap-1.5">
                  {index === 0 ? <PinIcon /> : <span className="h-1 w-1 rounded-full bg-neutral-700" />}
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
            <LevelMeter level={role.level} />
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-neutral-400 transition-all group-hover:border-brand-500/50 group-hover:bg-brand-500 group-hover:text-ink-950">
              <ArrowIcon />
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

  const toggleLocation = (locationId: LocationId) => {
    setSelectedLocations((previous) =>
      previous.includes(locationId)
        ? previous.filter((id) => id !== locationId)
        : [...previous, locationId],
    );
  };

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

    return matches.sort((a, b) =>
      sortBy === 'level-low' ? a.level - b.level : b.level - a.level,
    );
  }, [selectedDept, selectedLocations, sortBy]);

  const featured = filteredRoles.find((role) => role.featured);
  const standard = filteredRoles.filter((role) => !role.featured);

  const stats = [
    { value: String(roles.length), label: 'Open roles' },
    { value: '100%', label: 'Remote-first' },
    { value: '4', label: 'Departments' },
    { value: 'EST', label: 'Core time zone' },
  ];

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <div className="relative z-10">
        <SiteHeader
          action={
            <>
              <Link href="/hiring/sdr-placement" className={`${btnSecondary} ${btnSizeSm} hidden sm:inline-flex`}>
                SDR Placement
              </Link>
              <a href="#positions" className={`${btnPrimary} ${btnSizeSm}`}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ink-950 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink-950" />
                </span>
                {roles.length} open roles
              </a>
            </>
          }
        />

        {/* Hero */}
        <section className="px-5 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24 md:pb-24 md:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <p className={`${eyebrow} animate-rise`}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
              </span>
              Now hiring
            </p>

            <h1 className="animate-rise delay-1 mt-6 text-[2.1rem] font-semibold leading-[1.08] sm:text-5xl md:text-[3.5rem]">
              <span className="text-gradient">Curating the engine</span>
              <br className="hidden sm:block" /> to create trust, revenue &amp; retention.
            </h1>

            <p className="animate-rise delay-2 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              We are building infrastructure that compounds trust, revenue &amp; retention for service
              based businesses. We are looking for those devoted to building DivineAcquisition™ &amp; our
              future projects.
            </p>

            <div className="animate-rise delay-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#positions" className={`${btnPrimary} ${btnSizeMd} w-full sm:w-auto`}>
                Browse open roles
                <ArrowIcon />
              </a>
              <Link href="/hiring/sdr-placement" className={`${btnSecondary} ${btnSizeMd} w-full sm:w-auto`}>
                <svg className="h-3.5 w-3.5 text-brand-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.14v14l11-7-11-7Z" />
                </svg>
                Watch the SDR walkthrough
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <dl className="animate-rise delay-4 mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] sm:mt-16 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-ink-950/80 px-5 py-5 text-center">
                <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  {stat.label}
                </dt>
                <dd className="mt-1.5 text-2xl font-semibold tabular-nums text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>

          {/* Values */}
          <div className="animate-rise delay-5 mx-auto mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
            {values.map((value) => (
              <div key={value.name} className="panel rounded-2xl px-5 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  {value.name}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{value.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Positions */}
        <main id="positions" className="scroll-mt-24 px-5 pb-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col gap-2 border-t border-white/[0.07] pt-10 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={sectionLabel}>Open positions</p>
                <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                  Find where you fit
                </h2>
              </div>
              <p className="text-sm text-neutral-500">
                Showing <span className="font-semibold text-white">{filteredRoles.length}</span> of{' '}
                {roles.length} roles
              </p>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
              {/* Filter rail */}
              <aside className="lg:w-64 lg:shrink-0">
                <div className="panel sticky top-24 space-y-7 rounded-2xl p-5">
                  <div>
                    <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Department
                    </h3>
                    <div className="space-y-1">
                      {departments.map((dept) => {
                        const count = dept.id === 'all' ? roles.length : deptCounts[dept.id] || 0;
                        const isSelected = selectedDept === dept.id;
                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => setSelectedDept(dept.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-brand-500/12 text-brand-100 ring-1 ring-inset ring-brand-500/30'
                                : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                            }`}
                          >
                            <span>{dept.name}</span>
                            <span
                              className={`tabular-nums text-xs ${isSelected ? 'text-brand-300' : 'text-neutral-600'}`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Location
                    </h3>
                    <div className="space-y-1">
                      {locations.map((location) => {
                        const checked = selectedLocations.includes(location.id);
                        return (
                          <label
                            key={location.id}
                            className="group flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2 hover:bg-white/[0.03]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLocation(location.id)}
                              className="sr-only"
                            />
                            <span
                              aria-hidden
                              className={`flex h-4.5 w-4.5 items-center justify-center rounded-[5px] border transition-all ${
                                checked
                                  ? 'border-brand-500 bg-brand-500 text-ink-950'
                                  : 'border-white/15 bg-white/[0.03] group-hover:border-white/30'
                              }`}
                            >
                              {checked && (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="text-sm text-neutral-400 transition-colors group-hover:text-white">
                              {location.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Sort by
                    </h3>
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value)}
                        aria-label="Sort roles"
                        className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 pr-9 text-sm text-neutral-300 transition-colors hover:border-white/20 focus:border-brand-500/60 focus:outline-none"
                      >
                        <option value="level-high">Seniority: high to low</option>
                        <option value="level-low">Seniority: low to high</option>
                      </select>
                      <svg
                        aria-hidden
                        className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8 9 4-4 4 4m0 6-4 4-4-4" />
                      </svg>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Time zone
                    </p>
                    <p className="mt-1 text-sm text-neutral-300">EST (Eastern Standard Time)</p>
                  </div>
                </div>
              </aside>

              {/* Listings */}
              <div className="min-w-0 flex-1 space-y-3.5">
                {featured && <FeaturedRoleCard role={featured} />}
                {standard.map((role) => (
                  <RoleCard key={role.slug} role={role} />
                ))}

                {filteredRoles.length === 0 && (
                  <div className="panel rounded-2xl px-6 py-16 text-center">
                    <p className="text-neutral-400">No positions match these filters.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDept('all');
                        setSelectedLocations(['remote', 'us-md']);
                      }}
                      className={`${btnSecondary} ${btnSizeSm} mt-5`}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
