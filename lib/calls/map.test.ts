import { describe, expect, it } from 'vitest';
import { escapeFormulaValue, isRecordId, sanitizeSearchQuery } from './cells';
import { callsPublicPath, isCallsHost, isOnboardHost, leadProfilePath, onboardFormPath } from './config';
import {
  compareDatedDesc,
  compareLeads,
  debriefTitle,
  debriefWriteFields,
  entryHow,
  formatShortDate,
  historyFrom,
  httpUrlOrEmpty,
  isDebriefComplete,
  mapDebriefRecord,
  mapLeadRecord,
  mapTouchRecord,
  oneLineHistory,
  openerLine,
  scoreInputsFromLead,
  touchId,
  touchWriteFields,
} from './map';
import { leadSearchFormula, linkedToLeadFormula } from './queries';
import type { DebriefRecord, TouchRecord } from './types';

const closedWonLead = {
  id: 'recbhuwRMsnk618TH',
  fields: {
    'Lead Name': 'TEST - Closed Won (DM)',
    Email: 'won@example.com',
    Phone: '555-0100',
    'Company Name': 'Won Coaching',
    Stage: { name: 'Closed Won' },
    'Qualification Result': 'Qualified',
    'Readiness Score': 100,
    'Monthly Ad Spend': { name: '$5k+' },
    'Follow-Up Owner': 'Dedicated setter',
    'Program Price': '$5k+',
    'Pain Severity': 'Urgent',
    'Stated Pain': 'Parents opting in and never getting called back',
    'Lead Source': { name: 'IG DM' },
    'Entry Point': { name: 'DM Conversation' },
    'Source Trust Tier': 'T1 - Warm',
    'Touch Status': '⚫ Ghosted 30d+',
    'Days Since Touch': 46,
    'Next Action': '✓ Closed',
    'Call Brief Note': 'third attempt, prior two were voicemail',
    Touches: [
      { id: 'rec817iqLPDYw5PAn', name: 'Closed Won - 7/15 - DM' },
      { id: 'recl2OAd5mG8Gg3qy', name: 'Closed Won - 7/18 - Audit Call' },
    ],
    'Call Debriefs': [],
  },
};

describe('cells', () => {
  it('accepts Airtable record ids and rejects everything else', () => {
    expect(isRecordId('recbhuwRMsnk618TH')).toBe(true);
    expect(isRecordId('recsGCP9YvsZMeKmX')).toBe(true);
    expect(isRecordId('phone')).toBe(false);
    expect(isRecordId("rec'; DELETE")).toBe(false);
  });

  it('escapes formula quotes the Airtable way', () => {
    expect(escapeFormulaValue("O'Brien")).toBe("O''Brien");
    expect(sanitizeSearchQuery("{Qualification Result}='Qualified'")).toBe(
      "Qualification Result ='Qualified'",
    );
  });
});

describe('host paths', () => {
  it('uses bare paths on calls.divineacquisition.io and /calls elsewhere', () => {
    expect(isCallsHost('calls.divineacquisition.io')).toBe(true);
    expect(isCallsHost('calls.divineacquisition.io:443')).toBe(true);
    expect(isCallsHost('acq.divineacquisition.io')).toBe(false);
    expect(callsPublicPath('/abc', 'calls.divineacquisition.io')).toBe('/abc');
    expect(callsPublicPath('/abc', 'localhost')).toBe('/calls/abc');
    expect(leadProfilePath('recbhuwRMsnk618TH', 'localhost')).toBe('/calls/recbhuwRMsnk618TH');
    expect(leadProfilePath('recbhuwRMsnk618TH', 'calls.divineacquisition.io')).toBe(
      '/recbhuwRMsnk618TH',
    );
    expect(isOnboardHost('onboard.divineacquisition.io')).toBe(true);
    expect(onboardFormPath('recbhuwRMsnk618TH.sig', 'onboard.divineacquisition.io')).toBe(
      '/recbhuwRMsnk618TH.sig',
    );
    expect(onboardFormPath('recbhuwRMsnk618TH.sig', 'localhost')).toBe(
      '/onboard/recbhuwRMsnk618TH.sig',
    );
  });
});

describe('mapLeadRecord', () => {
  it('maps select objects, formulas, and linked ids from the live Closed Won test lead', () => {
    const lead = mapLeadRecord(closedWonLead);
    expect(lead.fullName).toBe('TEST - Closed Won (DM)');
    expect(lead.companyName).toBe('Won Coaching');
    expect(lead.stage).toBe('Closed Won');
    expect(lead.readinessScore).toBe(100);
    expect(lead.leadSource).toBe('IG DM');
    expect(lead.entryPoint).toBe('DM Conversation');
    expect(lead.sourceTrustTier).toBe('T1 - Warm');
    expect(lead.callBriefNote).toBe('third attempt, prior two were voicemail');
    expect(lead.touchIds).toEqual(['rec817iqLPDYw5PAn', 'recl2OAd5mG8Gg3qy']);
    expect(lead.debriefIds).toEqual([]);
    expect(openerLine(lead)).toBe('Parents opting in and never getting called back');
    expect(entryHow(lead)).toBe('DM Conversation · IG DM');
    expect(lead.scoreInputs).toEqual([
      { label: 'Ad spend', value: '$5k+', points: 35 },
      { label: 'Follow-up owner', value: 'Dedicated setter', points: 30 },
      { label: 'Program price', value: '$5k+', points: 20 },
    ]);
  });

  it('falls back to coaching niche when company is blank', () => {
    const lead = mapLeadRecord({
      id: 'recsGCP9YvsZMeKmX',
      fields: { 'Lead Name': 'Pat', 'Coaching Niche': 'B2B coaching' },
    });
    expect(lead.companyName).toBe('B2B coaching');
  });
});

describe('scoreInputsFromLead', () => {
  it('matches the live Readiness Score formula for the three displayed inputs', () => {
    expect(scoreInputsFromLead({
      monthlyAdSpend: '$2-5k',
      followUpOwner: 'Not sure',
      programPrice: '$2-5k',
    }).reduce((sum, input) => sum + input.points, 0)).toBe(52);
  });
});

describe('touches and debriefs', () => {
  it('maps a REST-shaped touch and a MCP-shaped touch the same way', () => {
    const rest = mapTouchRecord({
      id: 'recl2OAd5mG8Gg3qy',
      fields: {
        'Touch ID': 'Closed Won - 7/18 - Audit Call',
        Date: '2026-07-18',
        Channel: 'Call',
        Outcome: 'Replied',
        Sentiment: 'Positive',
        Summary: 'Leak audit held.',
        Lead: ['recbhuwRMsnk618TH'],
      },
    });
    const mcp = mapTouchRecord({
      id: 'recl2OAd5mG8Gg3qy',
      fields: {
        Channel: { name: 'Call' },
        Outcome: { name: 'Replied' },
        Date: '2026-07-18',
        Summary: 'Leak audit held.',
        Lead: [{ id: 'recbhuwRMsnk618TH' }],
      },
    });
    expect(rest.channel).toBe('Call');
    expect(mcp.channel).toBe('Call');
    expect(rest.leadIds).toEqual(['recbhuwRMsnk618TH']);
    expect(mcp.leadIds).toEqual(['recbhuwRMsnk618TH']);
  });

  it('treats a debrief as a draft until Outcome, Agreed Next Step, and Deal Risk are all filled', () => {
    const draft = mapDebriefRecord({
      id: 'recAAAAAAAAAAAAAAAA',
      fields: {
        Debrief: 'Jordan - 9/3',
        'Call Date': '2026-09-03',
        'Stated Goal': 'More booked calls',
        Lead: ['recsGCP9YvsZMeKmX'],
      },
    });
    const complete = mapDebriefRecord({
      id: 'recBBBBBBBBBBBBBBBB',
      fields: {
        Outcome: 'Proposal Out',
        'Agreed Next Step': 'Send the one-pager tomorrow',
        'Deal Risk': 'Wife handles the finances and was not on the call',
        Transcript: 'long pasted meet transcript',
        Lead: ['recsGCP9YvsZMeKmX'],
      },
    });
    expect(draft.complete).toBe(false);
    expect(complete.complete).toBe(true);
    expect(isDebriefComplete(complete)).toBe(true);
  });
});

describe('history', () => {
  it('orders touches and debriefs most recent first', () => {
    const touches: TouchRecord[] = [
      {
        recordId: 'recOldTouch0000000',
        touchId: '',
        date: '2026-07-15',
        direction: 'Outbound',
        touchClass: 'Human',
        channel: 'DM',
        outcome: 'Replied',
        sentiment: 'Neutral',
        summary: 'Opener sent',
        recordingLink: '',
        transcript: '',
        leadIds: ['recbhuwRMsnk618TH'],
      },
      {
        recordId: 'recNewTouch0000000',
        touchId: '',
        date: '2026-07-18',
        direction: 'Outbound',
        touchClass: 'Human',
        channel: 'Call',
        outcome: 'Replied',
        sentiment: 'Positive',
        summary: 'Leak audit held',
        recordingLink: '',
        transcript: '',
        leadIds: ['recbhuwRMsnk618TH'],
      },
    ];
    const debriefs: DebriefRecord[] = [
      {
        recordId: 'recDebrief00000000',
        title: 'Won - 7/18',
        callDate: '2026-07-18',
        callType: 'Discovery',
        owner: 'Malik',
        statedGoal: '',
        currentSituation: '',
        whatTheyTried: '',
        whyNow: '',
        outcome: 'Proposal Out',
        objection: 'DIY',
        amountQuoted: 15000,
        decisionMakers: '',
        theirTimeline: '',
        agreedNextStep: 'Send audit doc',
        nextStepDate: '2026-07-19',
        closeConfidence: 4,
        dealRisk: 'DIY pull',
        recordingLink: '',
        transcript: '',
        leadIds: ['recbhuwRMsnk618TH'],
        complete: true,
      },
    ];
    const history = historyFrom(touches, debriefs);
    expect(history.map((line) => line.id)).toEqual([
      'recDebrief00000000',
      'recNewTouch0000000',
      'recOldTouch0000000',
    ]);
    expect(oneLineHistory(history[2])).toBe('7/15 · DM · Replied — Opener sent');
    expect(oneLineHistory(history[0])).toContain('Audit · Discovery');
  });

  it('sorts leads by Next Action urgency, then days since touch', () => {
    const callNow = mapLeadRecord({
      id: 'recsGCP9YvsZMeKmX',
      fields: {
        'Lead Name': 'A',
        'Next Action': '🔴 CALL NOW - qualified, never contacted',
        'Days Since Touch': 999,
      },
    });
    const closed = mapLeadRecord({
      id: 'recbhuwRMsnk618TH',
      fields: { 'Lead Name': 'B', 'Next Action': '✓ Closed', 'Days Since Touch': 46 },
    });
    const chase = mapLeadRecord({
      id: 'recmHuCFcxtHMfK19',
      fields: {
        'Lead Name': 'C',
        'Next Action': '🟠 CHASE THE BOOKING',
        'Days Since Touch': 12,
      },
    });
    expect([closed, chase, callNow].sort(compareLeads).map((lead) => lead.fullName)).toEqual([
      'A',
      'C',
      'B',
    ]);
  });
});

describe('write payloads', () => {
  it('writes a human outbound touch the way the Log Touch form does, plus optional attachments', () => {
    const fields = touchWriteFields({
      leadId: 'recsGCP9YvsZMeKmX',
      leadName: 'TEST - Qualified, No Contact',
      date: '2026-09-03',
      channel: 'Call',
      outcome: 'No Answer',
      sentiment: 'Neutral',
      summary: 'Voicemail, will try again tomorrow',
      recordingLink: 'https://drive.google.com/file/d/abc',
      transcript: 'short paste',
    });
    expect(fields).toEqual({
      'Touch ID': 'TEST - Qualified, No Contact - 9/3 - Call',
      Date: '2026-09-03',
      Direction: 'Outbound',
      'Touch Class': 'Human',
      Channel: 'Call',
      Outcome: 'No Answer',
      Sentiment: 'Neutral',
      Summary: 'Voicemail, will try again tomorrow',
      Lead: ['recsGCP9YvsZMeKmX'],
      'Recording Link': 'https://drive.google.com/file/d/abc',
      Transcript: 'short paste',
    });
  });

  it('omits empty optional fields so a fifteen-second touch stays a fifteen-second touch', () => {
    const fields = touchWriteFields({
      leadId: 'recsGCP9YvsZMeKmX',
      leadName: 'Jordan',
      date: '2026-09-03',
      channel: 'SMS',
      outcome: 'Replied',
      sentiment: 'Positive',
      summary: 'Booked for Thursday',
    });
    expect(fields['Recording Link']).toBeUndefined();
    expect(fields.Transcript).toBeUndefined();
    expect(touchId('Jordan', '2026-09-03', 'SMS')).toBe('Jordan - 9/3 - SMS');
  });

  it('creates a complete debrief payload Airtable automations can see on record creation', () => {
    const fields = debriefWriteFields({
      leadId: 'recsGCP9YvsZMeKmX',
      leadName: 'Jordan Blake',
      callDate: '2026-09-03',
      callType: 'Discovery',
      owner: 'Malik',
      statedGoal: 'Stop leaking booked calls',
      currentSituation: 'Setter is inconsistent',
      whatTheyTried: 'More automations',
      whyNow: 'Ads are on',
      outcome: 'Proposal Out',
      objection: 'DIY',
      amountQuoted: 15000,
      decisionMakers: 'Founder',
      theirTimeline: 'This week',
      agreedNextStep: 'Send the one-pager',
      nextStepDate: '2026-09-04',
      closeConfidence: 4,
      dealRisk: 'May try to DIY for another quarter',
      recordingLink: 'https://drive.google.com/file/d/meet',
      transcript: 'Meet transcript paste',
      complete: true,
    });
    expect(fields.Debrief).toBe('Jordan Blake - 9/3');
    expect(fields.Lead).toEqual(['recsGCP9YvsZMeKmX']);
    expect(fields.Outcome).toBe('Proposal Out');
    expect(fields['Agreed Next Step']).toBe('Send the one-pager');
    expect(fields['Deal Risk']).toBe('May try to DIY for another quarter');
    expect(fields.Transcript).toBe('Meet transcript paste');
    expect(fields['Close Confidence']).toBe(4);
    expect(debriefTitle('Maria Lopez', '2026-08-24')).toBe('Maria Lopez - 8/24');
  });

  it('keeps a draft payload free of the three complete-required fields so the same record can be finished later', () => {
    const fields = debriefWriteFields({
      leadId: 'recsGCP9YvsZMeKmX',
      leadName: 'Jordan Blake',
      callDate: '2026-09-03',
      callType: 'Discovery',
      owner: 'Malik',
      statedGoal: 'still talking',
      complete: false,
    });
    expect(fields.Outcome).toBeUndefined();
    expect(fields['Agreed Next Step']).toBeUndefined();
    expect(fields['Deal Risk']).toBeUndefined();
    expect(fields['Stated Goal']).toBe('still talking');
    expect(isDebriefComplete(fields as { outcome?: string })).toBe(false);
  });

  it('rejects non-http recording links', () => {
    expect(httpUrlOrEmpty('javascript:alert(1)')).toBe('');
    expect(httpUrlOrEmpty('not a url')).toBe('');
    expect(httpUrlOrEmpty('https://drive.google.com/file/d/abc')).toContain('https://');
  });
});

describe('leadSearchFormula', () => {
  it('searches the same contact fields as the booking panel', () => {
    expect(leadSearchFormula('')).toBeNull();
    const formula = leadSearchFormula("O'Brien");
    expect(formula).toContain("FIND('o''brien',LOWER({Lead Name}&''))");
    expect(formula).toContain("FIND('o''brien',LOWER({Email}&''))");
    expect(formula).toContain("FIND('o''brien',LOWER({Company Name}&''))");
  });

  it('finds linked touches and debriefs by the lead record id', () => {
    expect(linkedToLeadFormula('recsGCP9YvsZMeKmX')).toBe(
      "FIND('recsGCP9YvsZMeKmX',ARRAYJOIN({Lead}))",
    );
  });
});

describe('compareDatedDesc', () => {
  it('places blank dates after dated rows', () => {
    expect(
      compareDatedDesc({ date: '', recordId: 'recA' }, { date: '2026-09-01', recordId: 'recB' }),
    ).toBe(1);
  });
});

describe('formatShortDate', () => {
  it('matches the Zapier Touch ID date style', () => {
    expect(formatShortDate('2026-07-19')).toBe('7/19');
    expect(formatShortDate('2026-09-03')).toBe('9/3');
  });
});
