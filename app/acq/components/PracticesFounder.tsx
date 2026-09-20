import Image from 'next/image';
import { sectionLabel } from '@/app/components/ui';
import { Panel } from '@/components/ui/panel';
import { PRACTICES } from '@/lib/acq/copy';

export default function PracticesFounder() {
  const { founder, beliefs } = PRACTICES;

  return (
    <div className="space-y-16 sm:space-y-20">
      <section aria-labelledby="practices-founder-heading">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] lg:gap-12">
          <figure className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <Panel className="relative overflow-hidden rounded-3xl p-0">
              <div className="relative aspect-[4/5] bg-ink-900">
                <Image
                  src="/acq/malik.jpg"
                  alt={founder.photoAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 420px, 90vw"
                  className="object-cover object-[50%_18%]"
                />
              </div>
            </Panel>
            <figcaption className="mt-4 text-center lg:text-left">
              <p className="acq-headline text-base font-semibold text-white">{founder.name}</p>
              <p className="mt-0.5 text-sm text-neutral-500">{founder.role}</p>
            </figcaption>
          </figure>

          <div>
            <p className={sectionLabel}>{founder.eyebrow}</p>
            <h2
              id="practices-founder-heading"
              className="acq-headline mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl"
            >
              {founder.intro}
            </h2>
            <div className="mt-6 space-y-5 text-sm font-medium leading-relaxed text-neutral-300 sm:text-[15px]">
              {founder.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="practices-beliefs-heading">
        <p className={sectionLabel}>{beliefs.eyebrow}</p>
        <h2
          id="practices-beliefs-heading"
          className="acq-headline mt-3 max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-3xl"
        >
          {beliefs.lead}
        </h2>
        <p className="mt-5 max-w-3xl text-sm font-medium leading-relaxed text-neutral-300 sm:text-[15px]">
          {beliefs.body}
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {beliefs.items.map((item) => (
            <li key={item.title}>
              <Panel className="h-full rounded-2xl p-5">
                <p className="acq-headline flex items-start gap-2 text-[15px] font-semibold leading-snug text-white">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{item.body}</p>
              </Panel>
            </li>
          ))}
        </ul>

        <Panel className="mt-3 rounded-2xl p-5 sm:p-6">
          <p className="acq-headline text-lg font-semibold text-white">{beliefs.closeTitle}</p>
          <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-300 sm:text-[15px]">
            {beliefs.closeBody}
          </p>
        </Panel>
      </section>
    </div>
  );
}
