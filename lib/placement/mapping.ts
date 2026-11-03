/** Rank a client's real GHL records against a template's suggested names. */

export type Named = { id: string; name: string };

export type MappingRow = {
  key: string;
  label: string;
  pool: 'calendars' | 'stages' | 'pipelines' | 'tags';
  suggestedName: string;
  multiple: boolean;
};

export function rankNames(wanted: string, options: Named[]): Named[] {
  const needle = wanted.trim().toLowerCase();
  if (!needle) return options;
  return [...options].sort((a, b) => score(b.name, needle) - score(a.name, needle) || a.name.localeCompare(b.name));
}

function score(name: string, needle: string): number {
  const hay = name.trim().toLowerCase();
  if (!hay) return 0;
  if (hay === needle) return 3;
  if (hay.includes(needle) || needle.includes(hay)) return 2;
  const words = needle.split(/\s+/).filter((word) => word.length > 2);
  return words.some((word) => hay.includes(word)) ? 1 : 0;
}

export function bestMatch(wanted: string, options: Named[]): Named | null {
  if (!wanted.trim()) return null;
  const ranked = rankNames(wanted, options);
  const top = ranked[0];
  if (!top || score(top.name, wanted.trim().toLowerCase()) === 0) return null;
  return top;
}

export function mappingRows(input: {
  outcomes: Array<{ name: string }>;
  calendars: string[];
  stage: string | null;
  tag: string | null;
  tracksResults: boolean;
  tracksSpeed: boolean;
  tracksReactivation: boolean;
}): MappingRow[] {
  const rows: MappingRow[] = [];
  input.outcomes.forEach((outcome, index) => {
    const calendar = input.calendars[index] ?? input.calendars[0] ?? outcome.name;
    rows.push({
      key: `outcome_calendar_${index}`,
      label: `${outcome.name}: calendar`,
      pool: 'calendars',
      suggestedName: calendar,
      multiple: false,
    });
    if (input.stage && index === input.outcomes.length - 1) {
      rows.push({
        key: `outcome_stage_${index}`,
        label: `${outcome.name}: stage`,
        pool: 'stages',
        suggestedName: input.stage,
        multiple: false,
      });
    }
    rows.push({
      key: `outcome_tags_all_${index}`,
      label: `${outcome.name}: tags required together`,
      pool: 'tags',
      suggestedName: '',
      multiple: true,
    });
    rows.push({
      key: `outcome_tags_any_${index}`,
      label: `${outcome.name}: one of these tags`,
      pool: 'tags',
      suggestedName: '',
      multiple: true,
    });
  });
  if (input.tracksSpeed) {
    rows.push({
      key: 'speed',
      label: 'Speed-to-lead leads',
      pool: 'tags',
      suggestedName: 'speed-to-lead',
      multiple: true,
    });
  }
  if (input.tracksReactivation) {
    rows.push({
      key: 'reactivation',
      label: 'Reactivation list',
      pool: 'tags',
      suggestedName: input.tag ?? 'reactivation-list',
      multiple: true,
    });
  }
  for (const tag of ['callback-requested', 'not-interested', 'wrong-number', 'do-not-call']) {
    rows.push({
      key: `disposition_${tag.replaceAll('-', '_')}`,
      label: `Disposition tag: ${tag}`,
      pool: 'tags',
      suggestedName: tag,
      multiple: true,
    });
  }
  if (input.tracksResults) {
    rows.push({
      key: 'show',
      label: 'Show rate calendars',
      pool: 'calendars',
      suggestedName: input.calendars[0] ?? 'Show',
      multiple: true,
    });
    rows.push({
      key: 'closes',
      label: 'Close pipelines',
      pool: 'pipelines',
      suggestedName: input.stage ?? 'Closed',
      multiple: true,
    });
  }
  return rows;
}

export type TagRule = { all: string[]; any: string[] };

export type SavedOutcome = {
  name: string;
  calendar_id?: string;
  stage_id?: string;
  tags?: TagRule;
};

export type SavedMapping = {
  outcomes: SavedOutcome[];
  speed: { ids: string[] };
  reactivation: { ids: string[] };
  dispositions: Record<string, string[]>;
  show_calendar_ids: string[];
  close_pipeline_ids: string[];
};

/** A win counts from a calendar, a stage, or a tag combination. Tags are for clients who book in another tool. */
export function outcomeIsMapped(outcome: {
  calendar_id?: string;
  stage_id?: string;
  tags?: { all?: string[]; any?: string[] };
}): boolean {
  const all = outcome.tags?.all?.filter(Boolean) ?? [];
  const any = outcome.tags?.any?.filter(Boolean) ?? [];
  return Boolean(outcome.calendar_id || outcome.stage_id || all.length > 0 || any.length > 0);
}

/** Confirmed rows become the mapping the sync already reads. Unconfirmed rows are left out. */
export function mappingFromConfirmed(input: {
  outcomes: Array<{ name: string }>;
  confirmed: Record<string, string[]>;
}): SavedMapping {
  const outcomes = input.outcomes.map((outcome, index) => {
    const row: SavedOutcome = { name: outcome.name };
    const calendar = input.confirmed[`outcome_calendar_${index}`]?.[0];
    const stage = input.confirmed[`outcome_stage_${index}`]?.[0];
    const all = (input.confirmed[`outcome_tags_all_${index}`] ?? []).filter(Boolean);
    const any = (input.confirmed[`outcome_tags_any_${index}`] ?? []).filter(Boolean);
    if (calendar) row.calendar_id = calendar;
    if (stage) row.stage_id = stage;
    if (all.length > 0 || any.length > 0) row.tags = { all, any };
    return row;
  });
  const disposition = (key: string) => input.confirmed[`disposition_${key}`] ?? [];
  return {
    outcomes: outcomes.filter((outcome) => outcomeIsMapped(outcome)),
    speed: { ids: input.confirmed.speed ?? [] },
    reactivation: { ids: input.confirmed.reactivation ?? [] },
    dispositions: {
      callback_requested: disposition('callback_requested'),
      not_interested: disposition('not_interested'),
      wrong_number: disposition('wrong_number'),
      do_not_call: disposition('do_not_call'),
    },
    show_calendar_ids: input.confirmed.show ?? [],
    close_pipeline_ids: input.confirmed.closes ?? [],
  };
}
