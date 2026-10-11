import type { FooterKind } from './blocks';

export type EmailAudience = 'candidate' | 'trainee' | 'operator' | 'client' | 'internal' | 'security';

export type EmailTemplate = {
  id: string;
  audience: EmailAudience;
  subject: string;
  preheader: string;
  body: string;
  footer: FooterKind;
  /** `included` means the body already ends with the sender sign-off. */
  signoff: 'included' | 'automated' | 'personal';
  personalFrom: boolean;
};

const hiring: EmailTemplate[] = [
  {
    id: 'A01',
    audience: 'candidate',
    subject: 'We received your application',
    preheader: 'Here is what happens next.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name],

Thank you for applying to be a Sales Operator with Divine Acquisition. We received your application.

What happens next:
1. We review every application within [Number of days] business days.
2. If there is a fit, we will invite you to a 30 minute interview.
3. Interviews are structured and specific. Come ready to give real examples.

You do not need to do anything else right now. If your availability or contact details change, reply to this email.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A02',
    audience: 'candidate',
    subject: 'Your interview with Divine Acquisition',
    preheader: '[Date] at [Time]. Here is how to prepare.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name],

Your interview is set.

Date: [Date]
Time: [Time] ([Time zone])
Length: about 30 minutes
Where: [Link]

How to prepare:
- Be in a quiet space with reliable internet and a working headset.
- Expect 10 questions. One includes a short live roleplay.
- Be specific and honest. Real examples beat polished answers.
- If you do not know something, say so.

If you need to reschedule, reply at least 24 hours before and we will find another time.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A03',
    audience: 'candidate',
    subject: 'Reminder: your interview is tomorrow',
    preheader: '[Date] at [Time]. Link inside.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name], a reminder that your interview is tomorrow.

Date: [Date]
Time: [Time] ([Time zone])
Where: [Link]

Test your headset and internet beforehand. If something comes up, reply to this email as soon as you can.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A05',
    audience: 'candidate',
    subject: 'Next step: a second conversation',
    preheader: 'A short follow-up with the hiring manager.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name],

Thank you for your time in the interview. We would like to continue the conversation.

The next step is a short follow-up with [Manager name]. It may include a brief practice exercise so we can see how you work in a live situation.

Please choose a time here: [Link]

If you have questions before then, reply to this email.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A06',
    audience: 'candidate',
    subject: 'Your application with Divine Acquisition',
    preheader: 'An update on your application.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name],

Thank you for the time you put into your application and interview.

After careful review, we have decided not to move forward at this time. This is not a comment on your worth. Our process looks for a very specific fit for this role.

We will keep your details on file and may reach out if a better match opens up. We wish you the best.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A07',
    audience: 'candidate',
    subject: "You're in: next step is your agreement",
    preheader: 'Sign your agreement to open the Academy.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name],

We would like to bring you into the DA Operator Academy.

What the Academy is: a structured training program that prepares you to represent Divine Acquisition inside a client's business. It takes about five days of focused work. You will finish with a certification and become eligible for placement.

Your next step is to sign your agreement. You will receive it in a separate email from our signing service. Your access to the Academy opens as soon as it is signed.

Your manager is [Manager name].

If anything is unclear, reply to this email.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A08',
    audience: 'candidate',
    subject: 'Please sign your Divine Acquisition agreement',
    preheader: "Your Academy access opens once it's signed.",
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name],

Your Divine Acquisition operator agreement is ready for your signature.

Please read it fully before signing. It covers your role, confidentiality, and how placements work.

Sign here: [Link]

Your Academy access opens as soon as it is signed. If you have a question about any part of it, reply to this email before signing.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A09',
    audience: 'candidate',
    subject: 'Reminder: your agreement is waiting',
    preheader: 'It takes a few minutes to review and sign.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name], your agreement has not been signed yet. Your Academy access stays closed until it is.

Review and sign: [Link]

If something is holding you up, reply and tell us. We would rather fix it than lose time.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A10',
    audience: 'candidate',
    subject: 'Your agreement is still unsigned',
    preheader: "[Manager name] will follow up if we don't hear from you.",
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name], your agreement is still unsigned after three days.

Please review and sign here: [Link]

If you have changed your mind or your situation has changed, reply and let us know so we can close this out properly. Otherwise, [Manager name] will reach out to check in.

[Sender name]
Divine Acquisition`,
  },
  {
    id: 'A11',
    audience: 'candidate',
    subject: 'Closing your Academy enrollment',
    preheader: 'Your place has been released.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name],

We have not received your signed agreement, so we have released your place in the Academy.

If you still want to join, reply to this email within 7 days and we will reopen it. After that, you are welcome to apply again.

Thank you for your interest.

[Sender name]
Divine Acquisition`,
  },
];

const trainee: EmailTemplate[] = [
  {
    id: 'B01',
    audience: 'trainee',
    subject: 'Welcome to Divine Acquisition',
    preheader: 'Your Academy starts as soon as you sign.',
    personalFrom: true,
    signoff: 'included',
    footer: 'standard',
    body: `[First name], you're in.

Divine Acquisition builds the systems that help businesses acquire, retain, and compound. As an operator, you are the human behind those systems. This Academy is how we make sure you represent us with discipline from your first day.

Next steps:
1. Sign your agreement.
2. Log in to the Academy once it's signed.
3. Start Module 1.

Your program takes about five days. Your manager is [Manager name]. Reach them if you get stuck.

Devotion. Value. Exclusivity.
[Sender name]`,
  },
  {
    id: 'B02',
    audience: 'trainee',
    subject: 'Your Academy access is open',
    preheader: 'Start with Module 1: Who DA Is.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your agreement is signed and your access is open.

Start with Module 1: Who DA Is.
Sign in here: [Link]

Your target completion date is [Target date].

Tip: do the lessons in one focused block each day, then take the quiz while the material is fresh.`,
  },
  {
    id: 'B03',
    audience: 'trainee',
    subject: 'How the Academy works, plainly',
    preheader: 'Quizzes, attempts, and what happens if you get stuck.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], here is how the Academy works so nothing surprises you.

1. Lessons. Each lesson has a video, a written page, or both. Finish them in order.
2. Quizzes. Every module ends with a 5 question quiz. You need 4 of 5 to pass.
3. Attempts. You get 5 attempts per quiz. After a miss, you wait 30 minutes and review the lesson before trying again.
4. If you are stuck. If you use all 5 attempts, your program goes on hold for a review with your manager. This is a check that the material is landing. It is not a judgment about you.
5. Practice. Some modules include practice conversations with an AI lead, and short submissions your manager reviews.
6. The Final Quiz and certification. After Module 10 you take the Final Quiz, then a capstone practice conversation, then a sign-off with your supervisor.

The fastest path is simple: read closely, take your time, and use the review before a retry.

Continue: [Link]`,
  },
  {
    id: 'B04',
    audience: 'trainee',
    subject: 'Your next step is waiting',
    preheader: '[Next step name], about [Minutes] minutes.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you're on [Module name]. Next up: [Next step name]. It takes about [Minutes] minutes.

Pick it up today to stay on pace for [Target date]. If something is blocking you, reply to this email and we'll fix it.

Continue: [Link]`,
  },
  {
    id: 'B05',
    audience: 'trainee',
    subject: 'Checking in on your Academy progress',
    preheader: 'Anything we can fix on our side?',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], it has been two days since your last activity in the Academy.

Life gets busy. If something is in the way, whether it is time, a technical problem, or the material itself, tell us and we will help. [Manager name] is also available to talk.

When you are ready, your next step is [Next step name]: [Link]

If you need a different schedule, reply with what works for you.`,
  },
  {
    id: 'B06',
    audience: 'trainee',
    subject: 'Module [Module number] complete',
    preheader: 'Next up: [Next step name].',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], Module [Module number]: [Module name] is complete.

Next up is [Next step name]. You are [Number] percent through the program.

Continue: [Link]`,
  },
  {
    id: 'B07',
    audience: 'trainee',
    subject: 'Your submission has been reviewed',
    preheader: 'See the feedback and your next step.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your submission for [Module name] has been reviewed.

Some items are approved. A few need work. Open the Academy to see the comments on each item and resubmit only the ones marked "needs work."

Review feedback: [Link]

You have [Attempts left] submissions left for this practical.`,
  },
  {
    id: 'B07-approved',
    audience: 'trainee',
    subject: 'Your submission is approved',
    preheader: 'That requirement is complete.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your submission for [Module name] is approved. That requirement is complete. Next up: [Next step name].

Continue: [Link]`,
  },
  {
    id: 'B08',
    audience: 'trainee',
    subject: 'A person is reviewing your submission',
    preheader: 'Your result is coming. No action needed.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your [Simulation name or reflection] could not be scored automatically. That is a technical issue on our side, not a problem with your work.

A reviewer will score it by hand. You will see your result in the Academy within [Number of days] business days. You do not need to resubmit, and this does not count against your attempts.

Status: [Link]`,
  },
  {
    id: 'B09',
    audience: 'trainee',
    subject: 'Your Academy progress is on review',
    preheader: 'This is a check, not a judgment.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you've used all [Attempts max] attempts on [Quiz name]. Your program is on hold while [Manager name] reviews it with you.

This is not a decision about you. It's a check that the material is landing.

Next step: [Manager name] will reach out within [Number of days] business days to schedule a short call. Come ready to talk through the main concepts from [Quiz name].

While your program is on hold, you cannot open lessons or quizzes. You can view your status here: [Link]`,
  },
  {
    id: 'B10',
    audience: 'trainee',
    subject: 'Your review call with [Manager name]',
    preheader: '[Date] at [Time]. Here is what to expect.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your review call is set.

Date: [Date]
Time: [Time] ([Time zone])
With: [Manager name]
Length: about 15 minutes

What to expect: you will be asked to explain, in your own words, the main concepts from [Quiz name]. There are no trick questions. The goal is to find where the material is not landing and decide the best next step together.

Before the call, review your lessons for [Module name]. If you cannot make the time, reply right away.`,
  },
  {
    id: 'B11',
    audience: 'trainee',
    subject: 'Your Academy is reopened',
    preheader: 'Read your plan, then retake.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your review is complete. You have [Number] more attempts on [Quiz name] and a plan from [Manager name].

Read the plan, work through it, then retake when you're ready: [Link]

You will be asked to acknowledge the plan before your first retry unlocks.`,
  },
  {
    id: 'B12',
    audience: 'trainee',
    subject: 'Your Academy re-test date is set',
    preheader: 'Your re-test opens on [Retest date].',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your review is complete. You have more time to prepare. Your re-test opens on [Retest date]. Your plan from [Manager name] is waiting in the Academy: [Link]

Use the time. The material is what matters.`,
  },
  {
    id: 'B13',
    audience: 'trainee',
    subject: 'Your re-test opens tomorrow',
    preheader: 'A short reminder to review your plan.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your re-test for [Quiz name] opens tomorrow, [Retest date].

Reread your plan and the lessons it points to: [Link]

You have [Number] attempts. Take your time.`,
  },
  {
    id: 'B14',
    audience: 'trainee',
    subject: 'Your Academy access has ended',
    preheader: 'An update after your review.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], after your review with [Manager name], we've decided not to continue your Academy program. Your access has ended.

Thank you for the effort you put in. If you have questions about next steps, reply to this email.`,
  },
  {
    id: 'B15',
    audience: 'trainee',
    subject: 'The Final Quiz is open',
    preheader: 'It draws from every module. Review first.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you've completed Modules 1 through 10. The Final Quiz is now open. It draws questions from every module.

Take your time and review before you start: [Link]

You need 85 percent to pass. You have [Attempts max] attempts.`,
  },
  {
    id: 'B16',
    audience: 'trainee',
    subject: 'One step left: your supervisor sign-off',
    preheader: 'A short call with [Supervisor name].',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you passed the Final Quiz and the capstone. One step remains: a sign-off call with [Supervisor name].

They will schedule it with you shortly. Expect a short conversation about how you would handle real situations with a client. Come ready to explain the DA Standard in your own words.

Status: [Link]`,
  },
  {
    id: 'B17',
    audience: 'trainee',
    subject: 'Your sign-off needs one more step',
    preheader: 'Your plan and re-review date are in the Academy.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your supervisor reviewed your readiness and wants a bit more before certifying you. The areas to work on and your plan are in the Academy: [Link]

Your re-review is on [Retest date]. This is about readiness, not worth. Use the time well.`,
  },
  {
    id: 'B18',
    audience: 'trainee',
    subject: "You're certified",
    preheader: 'Level 1: Certified Operator.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you completed the DA Operator Academy and earned Level 1: Certified Operator. That means you are trusted to represent DA inside a client's business.

Your manager, [Manager name], will reach out about your placement.

Your certificate: [Certificate link]
Your renewal date: [Renewal date]

Keep the standard.`,
  },
  {
    id: 'B19',
    audience: 'trainee',
    subject: "You're certified in [Vertical]",
    preheader: 'Level 2 earned.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you earned Level 2: Vertical Certified in [Vertical]. You're cleared to work inside [Vertical] accounts.

Your certificate: [Certificate link]`,
  },
  {
    id: 'B20',
    audience: 'trainee',
    subject: 'Welcome to the DA team',
    preheader: 'Level 3: DA Internal.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you completed the [Track] track and earned Level 3: DA Internal. Welcome to the inside.

Your manager will walk you through what comes next.

Your certificate: [Certificate link]`,
  },
  {
    id: 'B21',
    audience: 'operator',
    subject: 'Your certification renews on [Renewal date]',
    preheader: 'A short refresher keeps you active.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your DA certification is due for renewal on [Renewal date]. Start your refresher here: [Link]

It takes a Final Quiz and one practice conversation, followed by a short supervisor approval.`,
  },
  {
    id: 'B22',
    audience: 'operator',
    subject: 'Seven days left to renew your certification',
    preheader: 'Renew by [Renewal date] to stay active.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your certification expires in 7 days, on [Renewal date].

If it lapses, you cannot be placed or stay on live accounts until you renew. Start now: [Link]

If something is in the way, reply and tell us.`,
  },
  {
    id: 'B23',
    audience: 'operator',
    subject: 'Your certification has expired',
    preheader: 'Renew to return to active status.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your DA certification expired on [Renewal date]. Your status is now Lapsed.

You can renew at any time: [Link]

Once you pass the Final Quiz, one practice conversation, and the supervisor approval, you return to active status.`,
  },
  {
    id: 'B24',
    audience: 'operator',
    subject: 'An update on your DA certification',
    preheader: 'Please read. Reply with any questions.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your DA certification has been revoked, effective [Date].

[Admin writes a short, factual reason here, with no accusations.]

If you believe this was a mistake, reply to this email within 7 days and a manager will review it with you.`,
  },
  {
    id: 'B25',
    audience: 'operator',
    subject: "You've been matched with a client",
    preheader: 'Here is what happens before you start.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you have been matched with a client.

Client: [Client]
Vertical: [Vertical]
Planned start: [Start date]
Manager: [Manager name]

Before you start:
1. Complete the [Vertical] pack in the Academy: [Link]
2. Join your manager for a short kickoff call (invite to follow).
3. Review the client brief in your operator workspace.

Until the pack is complete you are shadow only on this account.`,
  },
  {
    id: 'B26',
    audience: 'operator',
    subject: 'You start with [Client] tomorrow',
    preheader: 'A checklist for your first day.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], you start with [Client] tomorrow, [Start date].

First day checklist:
- Log in to the client workspace and confirm access works.
- Read the client brief and the offer details.
- Confirm your first shift time with [Manager name].
- Log every action from your first call.

If anything does not work, tell [Manager name] before you start, not after.`,
  },
  {
    id: 'B27',
    audience: 'operator',
    subject: 'Quick check-in on your first [Days] days',
    preheader: 'Three questions, two minutes.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], three quick questions about your first [Days] days with [Client]. It takes two minutes: [Pulse link]

Your answers go to [Manager name] so we can support you. The link works once and expires in 7 days.`,
  },
  {
    id: 'B28',
    audience: 'operator',
    subject: 'Reminder: your quick check-in',
    preheader: 'Still open for [Number] more days.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `A short reminder. Your two-minute check-in is still open: [Pulse link]`,
  },
  {
    id: 'B29',
    audience: 'operator',
    subject: 'Your placement with [Client] has ended',
    preheader: 'Thank you. Here is what comes next.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[First name], your placement with [Client] ended on [End date].

Thank you for the work you put in. What happens next:
- Your status returns to Ready, and your manager will talk with you about your next placement.
- Please make sure all of your logs for the account are complete and submitted.
- Do not keep access to client data, accounts, or files. Your access has been removed.

Questions? Reply to this email.`,
  },
];

const client: EmailTemplate[] = [
  {
    id: 'C01',
    audience: 'client',
    subject: 'Meet your Divine Acquisition operator',
    preheader: '[Operator first name] starts on [Start date].',
    personalFrom: false,
    signoff: 'included',
    footer: 'client',
    body: `Hi [Client contact first name],

Your Divine Acquisition operator, [Operator first name], starts on [Start date].

What [Operator first name] will do for you:
- Respond to new leads quickly by call and text.
- Qualify them and book appointments.
- Hand qualified leads to your team.
- Log every action so you can see what happened.

What [Operator first name] will not do: quote prices outside your approved scope, or make promises about results.

Your point of contact at DA is [Manager name]. If anything needs attention, reply to this email.

Thank you,
Divine Acquisition`,
  },
  {
    id: 'C02',
    audience: 'client',
    subject: 'Quick check-in from Divine Acquisition',
    preheader: 'Two questions, under a minute.',
    personalFrom: false,
    signoff: 'included',
    footer: 'client',
    body: `Hi [Client contact first name],

Two quick questions about how [Operator first name] is doing so far. It takes under a minute: [Pulse link]

Thank you,
Divine Acquisition`,
  },
  {
    id: 'C04',
    audience: 'client',
    subject: 'Your operator placement ends on [End date]',
    preheader: 'Here is how the handover works.',
    personalFrom: false,
    signoff: 'included',
    footer: 'client',
    body: `Hi [Client contact first name],

A note that [Operator first name]'s placement with you ends on [End date].

What happens next:
- [Operator first name] will complete all logs before the end date.
- Access to your systems will be removed on [End date].
- Your DA contact, [Manager name], will confirm the final handover and answer any questions.

If you would like to continue or change the arrangement, reply to this email.

Thank you,
Divine Acquisition`,
  },
  {
    id: 'C05',
    audience: 'client',
    subject: 'A change to your operator',
    preheader: 'Your new operator and the handover plan.',
    personalFrom: false,
    signoff: 'included',
    footer: 'client',
    body: `Hi [Client contact first name],

We are changing the operator assigned to your account. Your new operator is [Operator first name], effective [Start date].

[Operator first name] has completed DA's certification and the [Vertical] pack. [Manager name] will manage the handover so nothing is dropped, including open leads and notes.

If you have any concerns, reply to this email and a manager will respond the same day.

Thank you,
Divine Acquisition`,
  },
];

const internal: EmailTemplate[] = [
  {
    id: 'D01',
    audience: 'internal',
    subject: '[DA Academy] Hold assigned: [Full name]',
    preheader: 'Review due [Review due date].',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `A hold has been assigned to you.

Trainee: [Full name]
Quiz or simulation: [Quiz name]
Attempts used: [Attempts used]
Review due: [Review due date]

Open the review: [Admin link]

Complete the review checklist, then choose Reset, Extend, or Release.`,
  },
  {
    id: 'D02',
    audience: 'internal',
    subject: '[DA Academy] Review due tomorrow: [Full name]',
    preheader: 'Due [Review due date].',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `The review for [Full name] is due tomorrow, [Review due date].

Open the review: [Admin link]`,
  },
  {
    id: 'D03',
    audience: 'internal',
    subject: '[DA Academy] OVERDUE hold: [Full name]',
    preheader: 'Review was due [Review due date].',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `The review for [Full name] was due on [Review due date] and is overdue.

Reviewer: [Reviewer name]
Open the review: [Admin link]

An admin will reassign it if it is not resolved today.`,
  },
  {
    id: 'D04',
    audience: 'internal',
    subject: '[DA Academy] Confirm release: [Full name]',
    preheader: 'A second confirmation is required.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `[Reviewer name] recommends releasing [Full name] from the Academy.

Review the notes and confirm or send it back: [Admin link]

The trainee keeps access until an admin confirms.`,
  },
  {
    id: 'D05',
    audience: 'internal',
    subject: '[DA Academy] Sign-off needed: [Full name]',
    preheader: 'Ready for supervisor review.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `[Full name] passed the Final Quiz and capstone and is ready for a supervisor sign-off.

Open the readiness summary: [Admin link]

Schedule the review call, complete the checklist, and approve or return it.`,
  },
  {
    id: 'D06',
    audience: 'internal',
    subject: '[DA Academy] [Number] submissions waiting',
    preheader: 'Oldest has waited [Hours] hours.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `You have [Number] practical submissions waiting. The oldest has been waiting [Hours] hours.

Review queue: [Admin link]`,
  },
  {
    id: 'D07',
    audience: 'internal',
    subject: '[DA Academy] Needs manual grading: [Full name]',
    preheader: 'A grader error needs a person.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `The automatic grader could not score [Full name]'s [Simulation name or reflection]. It needs a manual score.

Open it: [Admin link]`,
  },
  {
    id: 'D08',
    audience: 'internal',
    subject: '[DA Academy] Your week',
    preheader: 'Active, on hold, and what needs you.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `Last 7 days:
- Active trainees: [Number]
- Stalled: [Number]
- On hold: [Number] (overdue: [Number])
- Completed this week: [Number]
- Certified this week: [Number]
- Reviews waiting: [Number]
- Placements starting this week: [Number]
- Certifications expiring in 30 days: [Number]

What needs you first: [Admin link]`,
  },
  {
    id: 'D09',
    audience: 'internal',
    subject: '[DA Academy] New trainee: [Full name]',
    preheader: 'Your first check-in is due in 48 hours.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'internal',
    body: `[Full name] has enrolled in [Program]. You are their manager.

Target completion: [Target date]
Your first check-in: within 48 hours of access opening.

Their page: [Admin link]`,
  },
];

const security: EmailTemplate[] = [
  {
    id: 'I01',
    audience: 'security',
    subject: 'Confirm your email for the DA Academy',
    preheader: 'One click to confirm.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `Confirm your email to finish setting up your account:
[Link]

If you did not create this account, ignore this email.`,
  },
  {
    id: 'I02',
    audience: 'security',
    subject: 'Your DA Academy sign-in link',
    preheader: 'Works once. Expires soon.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `Use this link to sign in:
[Link]

It works once and expires in [Number] minutes. If you did not request it, you can ignore this email. Your account is safe.`,
  },
  {
    id: 'I03',
    audience: 'security',
    subject: 'Reset your DA Academy password',
    preheader: 'This link expires in [Number] minutes.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `We received a request to reset your password. Choose a new one here:
[Link]

If you did not ask for this, ignore this email. Your password has not changed.`,
  },
  {
    id: 'I04',
    audience: 'security',
    subject: 'Your DA Academy password was changed',
    preheader: 'If this was not you, act now.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `Your password was changed on [Date] at [Time]. If you made this change, no action is needed.

If you did not, reset your password right away and contact [Support email].`,
  },
  {
    id: 'I05',
    audience: 'security',
    subject: 'Confirm your new email address',
    preheader: 'Confirm to finish the change.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `Confirm this new email address for your DA Academy account:
[Link]

If you did not request this, contact [Support email] immediately.`,
  },
  {
    id: 'I06',
    audience: 'security',
    subject: "You've been invited to the DA Academy team",
    preheader: 'Set up your account to get started.',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `[Full name], [Sender name] invited you to the DA Academy as a [Reviewer or Admin].

Set up your account here:
[Link]

The link expires in [Number] days.`,
  },
  {
    id: 'I07',
    audience: 'security',
    subject: 'New sign-in to your DA Academy account',
    preheader: 'Was this you?',
    personalFrom: false,
    signoff: 'automated',
    footer: 'standard',
    body: `We noticed a sign-in to your account on [Date] at [Time] from a new device.

If this was you, no action is needed. If not, reset your password right away.`,
  },
];

export const EMAILS: EmailTemplate[] = [...hiring, ...trainee, ...client, ...internal, ...security];

export function emailTemplate(id: string): EmailTemplate | undefined {
  return EMAILS.find((template) => template.id === id);
}

/** Numbered series only. B07-approved is the approved variant of B07, not a 30th trainee email. */
export function seriesIds(prefix: string): string[] {
  return EMAILS.filter((template) => new RegExp(`^${prefix}\\d+$`).test(template.id)).map((template) => template.id);
}
