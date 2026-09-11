import { PRACTICE_TYPES, practiceTypeLabel, type PracticeType } from './calls';
import { HS_TRADES, hsTradeLabel, type HsTrade } from './hs-calls';

export type NicheFamily = 'practice' | 'home_services';
export type WorkspaceNiche = PracticeType | HsTrade;

export const NICHE_GROUPS: {
  family: NicheFamily;
  label: string;
  niches: readonly WorkspaceNiche[];
}[] = [
  { family: 'practice', label: 'Practices', niches: PRACTICE_TYPES },
  { family: 'home_services', label: 'Home services', niches: HS_TRADES },
];

export const WORKSPACE_NICHES: readonly WorkspaceNiche[] = NICHE_GROUPS.flatMap((group) => [...group.niches]);

export function isPracticeNiche(value: string): value is PracticeType {
  return (PRACTICE_TYPES as readonly string[]).includes(value);
}

export function isHomeServicesNiche(value: string): value is HsTrade {
  return (HS_TRADES as readonly string[]).includes(value);
}

export function parseNiche(value: string): WorkspaceNiche | null {
  if (isPracticeNiche(value)) return value;
  if (isHomeServicesNiche(value)) return value;
  return null;
}

export function nicheFamily(niche: WorkspaceNiche): NicheFamily {
  return isPracticeNiche(niche) ? 'practice' : 'home_services';
}

export function nicheLabel(niche: WorkspaceNiche): string {
  return isPracticeNiche(niche) ? practiceTypeLabel(niche) : hsTradeLabel(niche);
}

export function nichesForFamily(family: NicheFamily): readonly WorkspaceNiche[] {
  return NICHE_GROUPS.find((group) => group.family === family)?.niches ?? [];
}

export function familyLabel(family: NicheFamily): string {
  return family === 'practice' ? 'Practice' : 'Home services';
}
