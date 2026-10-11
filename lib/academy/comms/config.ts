/**
 * Defaults from the communications library. Test mode stays on until the
 * checklist in section K has been run. SMS and client contact stay off.
 */
export type AcademyCommsConfig = {
  fromName: string;
  senderName: string;
  fromAddress: string;
  replyTo: string;
  supportEmail: string;
  companyName: string;
  companyAddress: string;
  replyDays: number;
  timeZone: string;
  testMode: boolean;
  testEmail: string;
  testDiscordChannel: string;
  smsEnabled: boolean;
  clientContactEnabled: boolean;
  moduleCompleteEmailEnabled: boolean;
  newSignInAlerts: boolean;
  rolePing: string;
  trainingOrigin: string;
};

export const ACADEMY_COMMS: AcademyCommsConfig = {
  fromName: 'Divine Acquisition',
  senderName: 'Malik',
  fromAddress: 'academy@divineacquisition.io',
  replyTo: 'academy@divineacquisition.io',
  supportEmail: 'academy@divineacquisition.io',
  companyName: 'Divine Acquisition LLC',
  companyAddress: '7404 Executive Place, Lanham, MD 20706',
  replyDays: 2,
  timeZone: 'America/New_York',
  testMode: true,
  testEmail: 'academy@divineacquisition.io',
  testDiscordChannel: 'academy-test',
  smsEnabled: false,
  clientContactEnabled: false,
  moduleCompleteEmailEnabled: false,
  newSignInAlerts: false,
  rolePing: '',
  trainingOrigin: 'https://training.divineacquisition.io',
};

export function resolveCommsConfig(override?: Partial<AcademyCommsConfig>): AcademyCommsConfig {
  return { ...ACADEMY_COMMS, ...override };
}
