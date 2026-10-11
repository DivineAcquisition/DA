import { DISCORD_ALERTS } from './discord';
import { EMAILS, seriesIds } from './emails';
import { EVENTS, NEW_EMAIL_IDS } from './events';
import { IN_APP_GROUPS } from './inApp';
import { SMS } from './sms';

export { ACADEMY_COMMS, resolveCommsConfig } from './config';
export type { AcademyCommsConfig } from './config';
export { fillMerge, firstNameFrom, SAMPLE_FIELDS } from './fields';
export type { MergeFields } from './fields';
export { automatedSignature, clientFooter, internalFooter, personalSignature, standardFooter } from './blocks';
export { EMAILS, emailTemplate, seriesIds } from './emails';
export type { EmailTemplate } from './emails';
export { DISCORD_ALERTS, DISCORD_CHANNELS, discordAlert, NEW_DISCORD_IDS } from './discord';
export { SMS, smsTemplate } from './sms';
export { inApp, IN_APP_GROUPS } from './inApp';
export { certificateVerification, clientPulse, operatorPulse } from './pages';
export { renderDiscord, renderEmail, renderSms } from './render';
export type { RenderedEmail } from './render';
export { isQuietHours, isWeekend, nextWindow, nudgeBlock, zonedParts } from './rules';
export { EVENTS, NEW_EMAIL_IDS, academyEvent } from './events';
export type { AcademyEvent } from './events';
export { planDelivery } from './deliver';
export type { DeliveryInput, PlannedItem } from './deliver';
export { safetyViolations } from './safety';

export function assetCounts() {
  const discord = DISCORD_ALERTS.filter((alert) => !alert.system);
  return {
    hiringEmails: seriesIds('A').length,
    traineeEmails: seriesIds('B').length,
    clientEmails: seriesIds('C').length,
    internalEmails: seriesIds('D').length,
    securityEmails: seriesIds('I').length,
    discordChannelAlerts: discord.length,
    discordSystemAlerts: DISCORD_ALERTS.length - discord.length,
    sms: SMS.length,
    inAppGroups: IN_APP_GROUPS.length,
    securePages: 3,
    standardBlocks: 5,
    events: EVENTS.length,
    newEmails: NEW_EMAIL_IDS.length,
    templates: EMAILS.length,
  };
}
