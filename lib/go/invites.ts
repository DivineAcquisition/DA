import { GO_PUBLIC_ORIGIN } from './config';

export type StrategyInvite = {
  slug: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  timeZone: 'America/Los_Angeles' | 'America/New_York';
  constraint: string;
  eyebrow: string;
  headlineBefore: string;
  headlineAccent: string;
  lead: string;
  cover: readonly { title: string; body: string }[];
  bring: string;
};

const INVITES: readonly StrategyInvite[] = [
  {
    slug: 'luis',
    firstName: 'Luis',
    fullName: 'Luis',
    email: 'plfmaintenancesolutions@gmail.com',
    phone: '(909) 635-9178',
    company: 'PLF Cleaning Solutions',
    city: 'Chino Hills',
    timeZone: 'America/Los_Angeles',
    constraint: 'Lead flow',
    eyebrow: 'Prepared for Luis · PLF Cleaning Solutions',
    headlineBefore: 'The next clean should not depend on you ',
    headlineAccent: 'catching the phone.',
    lead: 'PLF is already cleaning in Chino Hills. The constraint is lead flow: an inquiry comes in, and too many of them never become a job on the calendar. This 30 minutes is for that path, not a tour of an offer.',
    cover: [
      {
        title: 'Where the inquiry dies',
        body: 'We walk the path from the Facebook lead to a booked clean and mark the step that actually drops people: the first reply, the quote, or the moment they are supposed to pick a time.',
      },
      {
        title: 'A place for the lead to land',
        body: 'PLF answers from a phone and a Gmail. We look at what a Chino Hills lead needs in order to book when you are on a job.',
      },
      {
        title: 'The one fix for this week',
        body: 'You said you want to move immediately. We leave with the single change that puts the next leads on the calendar without you being the only person who can answer.',
      },
    ],
    bring: 'A rough count is enough: leads last month, how many became quotes, and how many became jobs.',
  },
  {
    slug: 'sam',
    firstName: 'Sam',
    fullName: 'Sam Gupta',
    email: 'sam@cleanchaptercleaning.com',
    phone: '(917) 325-3739',
    company: 'Clean Chapter Cleaning',
    city: 'Harleysville',
    timeZone: 'America/New_York',
    constraint: 'Hiring cleaners',
    eyebrow: 'Prepared for Sam · Clean Chapter Cleaning',
    headlineBefore: 'More leads will not help until a cleaner ',
    headlineAccent: 'can take the job.',
    lead: 'Clean Chapter is new, and the constraint you named is hiring people who clean the way you would. This 30 minutes is about that seat: how someone gets found, tried, and kept in Harleysville before the calendar fills with work only you can do.',
    cover: [
      {
        title: 'What “good” means before you hire',
        body: 'We write the standard a cleaner has to meet, so the next hire is not a feeling after the first house.',
      },
      {
        title: 'How they get on the route',
        body: 'Screening, a paid trial clean, and the first two weeks. The point is a person who can run a job while you are not standing in the doorway.',
      },
      {
        title: 'What has to be true before the next ad',
        body: 'If the next lead still depends on you holding a mop, another Facebook lead makes the week heavier. We name the line you cross before more inquiries are useful.',
      },
    ],
    bring: 'How many jobs you can take this week by yourself, and where the last cleaner fell short.',
  },
];

export function inviteForSlug(slug: string): StrategyInvite | null {
  const key = slug.trim().toLowerCase();
  return INVITES.find((invite) => invite.slug === key) ?? null;
}

export function inviteUrl(slug: string): string {
  return `${GO_PUBLIC_ORIGIN}/invite/${slug}`;
}
