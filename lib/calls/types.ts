import type {
  DebriefCallType,
  DebriefObjection,
  DebriefOutcome,
  DebriefOwner,
  DebriefTimeline,
  TouchChannel,
  TouchOutcome,
  TouchSentiment,
} from './config';

export type ScoreInput = {
  label: string;
  value: string;
  points: number;
};

export type LeadRecord = {
  recordId: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  coachingNiche: string;
  stage: string;
  qualificationResult: string;
  readinessScore: number | null;
  monthlyAdSpend: string;
  followUpOwner: string;
  programPrice: string;
  painSeverity: string;
  statedPain: string;
  whyNow: string;
  leadSource: string;
  entryPoint: string;
  sourceTrustTier: string;
  touchStatus: string;
  daysSinceTouch: number | null;
  nextAction: string;
  auditOutcome: string;
  objection: string;
  dealValue: number | null;
  googleMeetUrl: string;
  notes: string;
  callBriefNote: string;
  touchIds: string[];
  debriefIds: string[];
  scoreInputs: ScoreInput[];
  airtableUrl: string;
};

export type TouchRecord = {
  recordId: string;
  touchId: string;
  date: string;
  direction: string;
  touchClass: string;
  channel: string;
  outcome: string;
  sentiment: string;
  summary: string;
  recordingLink: string;
  transcript: string;
  leadIds: string[];
};

export type DebriefRecord = {
  recordId: string;
  title: string;
  callDate: string;
  callType: string;
  owner: string;
  statedGoal: string;
  currentSituation: string;
  whatTheyTried: string;
  whyNow: string;
  outcome: string;
  objection: string;
  amountQuoted: number | null;
  decisionMakers: string;
  theirTimeline: string;
  agreedNextStep: string;
  nextStepDate: string;
  closeConfidence: number | null;
  dealRisk: string;
  recordingLink: string;
  transcript: string;
  leadIds: string[];
  complete: boolean;
};

export type HistoryKind = 'touch' | 'debrief';

export type HistoryLine = {
  id: string;
  kind: HistoryKind;
  date: string;
  type: string;
  outcome: string;
  summary: string;
};

export type LeadProfile = {
  lead: LeadRecord;
  touches: TouchRecord[];
  debriefs: DebriefRecord[];
  history: HistoryLine[];
};

export type PhoneTouchInput = {
  leadId: string;
  channel: TouchChannel;
  outcome: TouchOutcome;
  sentiment: TouchSentiment;
  summary: string;
  recordingLink?: string;
  transcript?: string;
};

export type AuditDebriefInput = {
  leadId: string;
  debriefId?: string;
  callDate: string;
  callType?: DebriefCallType | '';
  owner?: DebriefOwner | '';
  statedGoal?: string;
  currentSituation?: string;
  whatTheyTried?: string;
  whyNow?: string;
  outcome?: DebriefOutcome | '';
  objection?: DebriefObjection | '';
  amountQuoted?: number | null;
  decisionMakers?: string;
  theirTimeline?: DebriefTimeline | '';
  agreedNextStep?: string;
  nextStepDate?: string;
  closeConfidence?: number | null;
  dealRisk?: string;
  recordingLink?: string;
  transcript?: string;
  complete: boolean;
};
