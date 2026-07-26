/**
 * End-to-end walk through the document lifecycle, driven through the real UI
 * against the real database. Not a test suite: a check that the surfaces behave
 * the way the rules say they do, and a set of screenshots to look at.
 *
 *   node scripts/verify-documents.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

/** Page text from a PDF, so the print rules can be checked on real pages. */
function readPdfPages(path) {
  const out = execFileSync('python3', [
    '-c',
    'import sys,json;from pypdf import PdfReader;print(json.dumps([p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages]))',
    path,
  ]);
  return JSON.parse(out.toString());
}

const BASE = process.env.VERIFY_BASE ?? 'http://localhost:3100';
const ADMIN = { email: 'admin@vistrial.io', password: process.env.ADMIN_PASSWORD ?? '' };
const CLIENT = { email: 'renata@lumenaesthetics.com', password: process.env.CLIENT_PASSWORD ?? '' };
const SHOTS = 'artifacts/documents';

mkdirSync(SHOTS, { recursive: true });

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 1000 },
});

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

async function signIn(page, surface, { email, password }) {
  await page.goto(`${BASE}${surface}`, { waitUntil: 'networkidle2' });
  const emailField = await page.$('input[type="email"]');
  if (!emailField) return true; // already signed in
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return !(await page.$('input[type="email"]'));
}

const text = (page) => page.evaluate(() => document.body.innerText);

try {
  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------
  // Separate contexts so the admin and client sessions do not share cookies.
  const adminContext = await browser.createBrowserContext();
  const admin = await adminContext.newPage();
  record('admin signs in', await signIn(admin, '/da', ADMIN));

  await admin.goto(`${BASE}/da/documents`, { waitUntil: 'networkidle2' });
  const register = await text(admin);
  record('document register renders', register.includes('What was sent, and when'));
  record(
    'register flags what needs a look',
    register.includes('no baseline') || register.includes('monthly report'),
    register.split('\n').find((line) => line.includes('monthly report')) ?? '',
  );
  await shot(admin, '01-register');

  // The prospect: an audit findings report before any engagement exists.
  await admin.goto(`${BASE}/da/vance-plumbing-heating/documents`, { waitUntil: 'networkidle2' });
  await shot(admin, '02-case-documents');

  await admin.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('New document'));
    button?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await admin.select('select#type', 'audit_findings');
  await Promise.all([
    admin.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    admin.evaluate(() => {
      const button = [...document.querySelectorAll('button[type=submit]')].find((b) =>
        b.textContent.includes('Generate draft'),
      );
      button?.click();
    }),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const draftUrl = admin.url();
  record('audit findings generates for a prospect', /\/documents\/[0-9a-f-]{36}/.test(draftUrl), draftUrl);

  const draft = await text(admin);
  record('draft state is explained', draft.includes('Generated from live data at a point in time'));
  record(
    'gaps are surfaced before the client sees them',
    draft.includes('Not captured'),
    'missing baseline figures render as an explicit gap',
  );
  record('bound sections have no editor', !draft.includes('Where the operation stands today\nOutcome first'));
  record(
    'derived leak analysis resolved',
    draft.includes('Revenue lost to no response') && draft.includes('Recoverable from the dormant list'),
  );
  record('measurement provenance shown', draft.includes('Client estimate') && draft.includes('Measured'));
  await shot(admin, '03-draft-audit');

  // Rule 10, through the UI.
  const emDashWarned = await admin.evaluate(async () => {
    const area = document.querySelector('form#summary textarea');
    if (!area) return 'no textarea';
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, 'Response time is the leak \u2014 and it is expensive.');
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    return document.body.innerText.includes('There is an em dash in this text') ? 'warned' : 'silent';
  });
  record('em dash warned as the admin types', emDashWarned === 'warned', emDashWarned);
  await shot(admin, '04-em-dash-warning');

  // Fill the required narrative sections.
  const NARRATIVE = {
    summary:
      'Vance Plumbing loses roughly nine booked jobs a month to leads that never receive a reply. At the current average job value that is about 42,000 dollars of revenue leaving every month, before any change to marketing spend.',
    findings:
      'Inbound leads arrive at four places: the Google Ads form, the Business Profile, the website form and a shared mobile number. Nothing routes them into a single queue, so whoever is free answers and the rest wait. The average first reply is four and a half hours, and 51 leads a month get no reply at all.',
    roadmap:
      'Phase one consolidates every inbound channel into one queue with a five minute response standard, which moves response time and the unanswered count. Phase two works the dormant list of 1,930 contacts, which moves revenue without touching ad spend. Phase three adds confirmation and reminder sequences, which moves show rate once it can be measured properly.',
  };

  for (const [key, body] of Object.entries(NARRATIVE)) {
    const wrote = await admin.evaluate(
      async (sectionKey, value) => {
        const form = document.querySelector(`form#${sectionKey}`);
        if (!form) return false;
        const area = form.querySelector('textarea');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(area, value);
        area.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 200));
        form.querySelector('button[type=submit]').click();
        return true;
      },
      key,
      body,
    );
    if (!wrote) record(`narrative "${key}" written`, false, 'section form not found');
    await new Promise((resolve) => setTimeout(resolve, 1800));
  }
  await admin.reload({ waitUntil: 'networkidle2' });
  const written = await text(admin);
  record('narrative saved', written.includes('Vance Plumbing loses roughly nine booked jobs'));

  // Review, then publish.
  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Send to review'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await admin.reload({ waitUntil: 'networkidle2' });
  const review = await text(admin);
  record('review locks the draft', review.includes('Locked for a final read'));
  record('review preview shows the branding', review.includes('Prepared by Divine Acquisition'));
  await shot(admin, '05-in-review');

  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Publish to the client'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await admin.reload({ waitUntil: 'networkidle2' });
  const published = await text(admin);
  record('publication freezes the document', published.includes('Released and frozen'));
  record(
    'no client account means a share link',
    published.includes('share_link') || published.includes('Time limited link'),
    published.split('\n').find((line) => line.includes('Time limited')) ?? '',
  );
  record('an unopened report is called out', published.includes('Not opened yet'));
  record('published document offers no editor', !published.includes('Save section'));
  await shot(admin, '06-published');

  // Print rendering, which is where the running header and footer live.
  const pdf = await admin.pdf({ format: 'a4', printBackground: true });
  writeFileSync(`${SHOTS}/audit-findings.pdf`, pdf);
  record('prints to PDF', pdf.length > 20000, `${Math.round(pdf.length / 1024)} kB`);

  // Rule 5, checked on the actual printed pages rather than on screen.
  const pages = await readPdfPages(`${SHOTS}/audit-findings.pdf`);
  record(
    'the producer line is on every page',
    pages.length > 1 && pages.every((page) => page.includes('Prepared by Divine Acquisition')),
    `${pages.length} pages`,
  );
  record(
    'the generation date is on every page',
    pages.every((page) => /Generated \w+ \d+, \d{4}/.test(page)),
  );
  record(
    'page numbers count correctly',
    pages.every((page, index) => page.includes(`Page ${index + 1} of ${pages.length}`)),
    pages[0]?.match(/Page \d+ of \d+/)?.[0] ?? 'no page number found',
  );
  record(
    'the client name and title run as a header',
    pages.every((page) => page.includes('VANCE PLUMBING') && page.includes('Audit Findings Report')),
  );
  record(
    'the application chrome does not print',
    !pages.some((page) => /Sign out|Engagements Documents|internal\. Clients and operators/.test(page)),
  );
  await admin.emulateMediaType('print');
  await shot(admin, '07-print-view');
  await admin.emulateMediaType('screen');

  // -------------------------------------------------------------------------
  // A quarterly review for a client who has an account, then a case study drawn
  // from it. The narrative deliberately names the practice and the owner, which is
  // what the anonymisation scanner has to catch.
  // -------------------------------------------------------------------------
  await admin.goto(`${BASE}/da/lumen-aesthetics/documents`, { waitUntil: 'networkidle2' });
  const lumen = await text(admin);
  record('existing document listed for Lumen', lumen.includes('Monthly'));

  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('New document'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await admin.select('select#type', 'quarterly_review');
  await admin.evaluate(() => {
    const start = document.querySelector('input[name=period_start]');
    const end = document.querySelector('input[name=period_end]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(start, '2026-04-01');
    start.dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(end, '2026-07-20');
    end.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('input[name=include_effort]').click();
  });
  await Promise.all([
    admin.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    admin.evaluate(() => {
      [...document.querySelectorAll('button[type=submit]')].find((b) =>
        b.textContent.includes('Generate draft'),
      )?.click();
    }),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const quarterlyUrl = admin.url();
  record('quarterly review generates', /\/documents\/[0-9a-f-]{36}/.test(quarterlyUrl), quarterlyUrl);

  const quarterlyDraft = await text(admin);
  // innerText applies text-transform, and section headers are uppercase in the
  // house style, so titles are matched case-insensitively.
  record('trajectory block rendered', /direction of travel/i.test(quarterlyDraft));
  record('the arc has readings from baseline onward', /Baseline .*Latest/s.test(quarterlyDraft));
  record('effort disclosed when chosen', !quarterlyDraft.includes('work log was not included'));

  for (const [key, body] of Object.entries({
    summary:
      'Lumen Aesthetics went from answering inbound leads in just under seven hours to answering them in under four minutes, and revenue rose 27 percent against the March baseline over the quarter. Show rate is the one measure that has not moved.',
    assessment:
      'The response standard carried the quarter: booking rate rose with no change in lead volume, which means the same leads convert rather than more leads arriving. Show rate has stayed flat, and Renata declined the reminder cadence in April on the grounds that it felt pushy, so that ceiling is still in place by choice.',
    recommendations:
      'First, revisit the reminder sequence, which is now the single largest available gain. Second, work the dormant list, which has not been touched since the install. Third, hold the response standard through the autumn intake, when volume roughly doubles.',
  })) {
    await admin.evaluate(
      async (sectionKey, value) => {
        const form = document.querySelector(`form#${sectionKey}`);
        if (!form) return;
        const area = form.querySelector('textarea');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(area, value);
        area.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 200));
        form.querySelector('button[type=submit]').click();
      },
      key,
      body,
    );
    await new Promise((resolve) => setTimeout(resolve, 1800));
  }

  await admin.goto(quarterlyUrl, { waitUntil: 'networkidle2' });
  await shot(admin, '08a-quarterly-draft');

  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Send to review'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await admin.goto(quarterlyUrl, { waitUntil: 'networkidle2' });
  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Publish to the client'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 3500));
  await admin.goto(quarterlyUrl, { waitUntil: 'networkidle2' });
  const quarterly = await text(admin);
  record(
    'published to an account',
    quarterly.includes('Available at acct.vistrial.io'),
    'delivery recorded against the account channel',
  );
  record(
    'growth shows what got worse too',
    quarterly.includes('moved the wrong way') || quarterly.includes('none moved the wrong way'),
  );
  await shot(admin, '08-quarterly-published');

  // Rule 4: a correction is a new version with a visible note, not an edit.
  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Publish a correction'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await admin.type(
    'input#correction_note',
    'The show rate figure was read from the wrong snapshot. Corrected to the quarter ending 20 July.',
  );
  await Promise.all([
    admin.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    admin.evaluate(() => {
      [...document.querySelectorAll('button[type=submit]')].find((b) =>
        b.textContent.includes('Create version'),
      )?.click();
    }),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const correctionUrl = admin.url();
  const correction = await text(admin);
  record('correction opens a new version', correctionUrl !== quarterlyUrl && correction.includes('version 2'));
  record('the correction note is on the document', correction.includes('wrong snapshot'));
  record('narrative carried into the new version', correction.includes('Lumen Aesthetics went from answering'));
  await shot(admin, '08b-correction-v2');

  // A correction is only a correction once it reaches the client, so v2 is taken
  // all the way through review and publication.
  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Send to review'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await admin.goto(correctionUrl, { waitUntil: 'networkidle2' });
  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Publish to the client'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 3500));

  await admin.goto(quarterlyUrl, { waitUntil: 'networkidle2' });
  const original = await text(admin);
  record('the original stays exactly as sent', original.includes('Superseded by a later version'));
  record('the original is still not editable', !original.includes('Save section'));

  // Case study mode, drawn from the published quarterly.
  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Draft a case study'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await admin.type('input#descriptor', 'a med spa in the Mid-Atlantic');
  await admin.evaluate(() => {
    [...document.querySelectorAll('button[type=submit]')].find((b) =>
      b.textContent.includes('Create draft'),
    )?.click();
  });

  // The action redirects, so wait for the URL to actually change.
  for (let waited = 0; waited < 30 && admin.url() === quarterlyUrl; waited += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  const caseStudyUrl = admin.url();
  await admin.goto(caseStudyUrl, { waitUntil: 'networkidle2' });

  const caseStudy = await text(admin);
  record('case study draft created', caseStudy.includes('Case study draft, internal only'), caseStudyUrl);
  record(
    'identifiers flagged for a human',
    caseStudy.includes('references the scanner believes could identify'),
    caseStudy.split('\n').find((line) => line.includes('references the scanner')) ?? '',
  );
  record('the business name was caught', caseStudy.includes('Lumen Aesthetics'));
  record('the named contact was caught', caseStudy.includes('Renata'));
  record('subject reads as a descriptor', caseStudy.includes('a med spa in the Mid-Atlantic'));
  await shot(admin, '09-case-study-flags');

  // Every flag needs a decision. Rewrite the identifying ones.
  const REWRITES = {
    'Lumen Aesthetics': 'The practice',
    Lumen: 'The practice',
    Aesthetics: 'the practice',
    Renata: 'the owner',
  };

  let guard = 0;
  while (guard++ < 40) {
    const acted = await admin.evaluate(async (rewrites) => {
      const form = [...document.querySelectorAll('form')].find((f) =>
        [...f.querySelectorAll('button')].some(
          (b) => b.textContent.trim() === 'Not identifying' || b.textContent.trim() === 'Rewrite',
        ),
      );
      if (!form) return false;
      const snippet = form.querySelector('span.font-mono')?.textContent?.trim() ?? '';
      const input = form.querySelector('input[name=replacement]');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, rewrites[snippet] ?? '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // The input is controlled, so React has to re-render before the form is
      // submitted or the previous value is what gets sent.
      await new Promise((r) => setTimeout(r, 250));
      form.querySelector('button[type=submit]').click();
      return true;
    }, REWRITES);
    if (!acted) break;
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await admin.goto(caseStudyUrl, { waitUntil: 'networkidle2' });
  }

  await admin.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirm anonymisation'))?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 2200));
  await admin.goto(caseStudyUrl, { waitUntil: 'networkidle2' });
  const confirmed = await text(admin);
  record('confirmed draft becomes usable', confirmed.includes('Every flagged reference has a decision on it'));
  record('the rewrite reached the prose', confirmed.includes('The practice went from answering'));
  record('case study offers no publish button', !confirmed.includes('Publish to the client'));
  await shot(admin, '10-case-study-confirmed');

  // -------------------------------------------------------------------------
  // Client
  // -------------------------------------------------------------------------
  const clientContext = await browser.createBrowserContext();
  const client = await clientContext.newPage();
  record('client signs in', await signIn(client, '/acct', CLIENT));

  await client.goto(`${BASE}/acct/reports`, { waitUntil: 'networkidle2' });
  const reports = await text(client);
  record('client sees the published reports', reports.includes('Quarterly Review'));
  record(
    'client sees the corrected version and its note',
    reports.includes('version 2') && reports.includes('Correction:'),
  );
  record('client sees no draft or case study', !reports.includes('case study') && !reports.includes('Draft'));
  await shot(client, '11-client-reports');

  await Promise.all([
    client.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    client.evaluate(() => document.querySelector('a[href*="/acct/reports/"]')?.click()),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const clientDoc = await text(client);
  record('client reads the document', clientDoc.includes('Prepared by Divine Acquisition'));
  record('client sees their own name as the subject', clientDoc.includes('Lumen Aesthetics'));
  record('client sees the correction note', clientDoc.includes('wrong snapshot'));
  record(
    'no operator is named',
    !/Amara|Ochieng/i.test(clientDoc),
    'the milestone log names the placed operator internally; the document says "your operator"',
  );
  record(
    'nothing else from the never-see list appears',
    !/payout|margin|pay statement|commission|escalation/i.test(clientDoc),
  );
  record('client is told the open is recorded', clientDoc.includes('can see that you opened it'));
  await shot(client, '12-client-document');

  // A client cannot reach the admin surface.
  await client.goto(`${BASE}/da/documents`, { waitUntil: 'networkidle2' });
  const refused = await text(client);
  record('client refused the admin surface', refused.includes('admin-only') || refused.includes('Refused'));
  await shot(client, '13-client-refused');

  // The open should now be visible to the admin.
  await admin.goto(`${BASE}/da/documents`, { waitUntil: 'networkidle2' });
  const opens = await text(admin);
  record('admin sees the open recorded', /1×/.test(opens), opens.split('\n').find((l) => l.includes('×')) ?? '');
  await shot(admin, '14-register-with-opens');
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const failure of failed) console.log(`  ${failure.name} ${failure.detail}`);
  process.exitCode = 1;
}
