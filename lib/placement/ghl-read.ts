import { connect, serviceClient, type GhlSession } from '@/lib/ghl/client';
import { readLocationShape, readLocationUsers } from '@/lib/ghl/health';
import { bestMatch, mappingRows, rankNames, type MappingRow, type Named } from './mapping';

export type ProposalRow = MappingRow & {
  options: Named[];
  suggestedId: string | null;
};

export type GhlProposal = {
  connected: boolean;
  warning: string | null;
  users: Array<{ id: string; name: string; email: string }>;
  rows: ProposalRow[];
};

async function namedList(session: GhlSession, path: string, key: string, purpose: string): Promise<Named[]> {
  const response = await session.request('GET', path, {
    query: session.info.locationId ? { locationId: session.info.locationId } : undefined,
    purpose,
  });
  if (!response.ok || !response.data || typeof response.data !== 'object') return [];
  const body = response.data as Record<string, unknown>;
  const rows = Array.isArray(body[key]) ? body[key] : Array.isArray(response.data) ? response.data : [];
  return rows
    .map((row) => {
      const record = row as Record<string, unknown>;
      const id = String(record.id ?? '');
      const name = String(record.name ?? '');
      return id && name ? { id, name } : null;
    })
    .filter((row): row is Named => Boolean(row));
}

/** Read the client's sub-account and rank the template's names against it. The token stays on the server. */
export async function proposeGhlMapping(input: {
  caseFileId: string;
  placementId: string;
  outcomes: Array<{ name: string }>;
  suggestions: { calendars?: string[]; stage?: string | null; tag?: string | null };
  tracksResults: boolean;
  tracksSpeed: boolean;
  tracksReactivation: boolean;
}): Promise<{ ok: true; proposal: GhlProposal } | { ok: false; error: string }> {
  const db = serviceClient();
  if (!db) return { ok: false, error: 'The server sync key is not set, so GHL cannot be read from here.' };
  const picked = await connect(db, { caseFileId: input.caseFileId, purpose: 'location' });
  if (!picked.ok) {
    return {
      ok: true,
      proposal: {
        connected: false,
        warning: picked.reason,
        users: [],
        rows: decorate(input, { calendars: [], stages: [], pipelines: [], tags: [] }),
      },
    };
  }

  const locationId = picked.session.info.locationId ?? '';
  const [shape, users, sources] = await Promise.all([
    readLocationShape(picked.session),
    readLocationUsers(picked.session),
    namedList(picked.session, `/locations/${locationId}/customFields`, 'customFields', 'placement source fields'),
  ]);
  const calendars = shape.ok ? shape.shape.calendars : [];
  const pipelines = shape.ok ? shape.shape.pipelines.map((pipeline) => ({ id: pipeline.id, name: pipeline.name })) : [];
  const stages = shape.ok
    ? shape.shape.pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => ({ id: stage.id, name: `${pipeline.name}: ${stage.name}` })))
    : [];
  const tags = shape.ok ? [...shape.shape.tags, ...sources.filter((source) => !shape.shape.tags.some((tag) => tag.id === source.id))] : sources;
  const userRows = users.ok
    ? users.users.map((user) => ({ id: user.id, name: user.name ?? '', email: user.email ?? '' })).filter((user) => user.id)
    : [];

  if (input.placementId) {
    await db.rpc('so_ghl_save_catalog', {
      p_placement: input.placementId,
      p_catalog: { users: userRows, calendars, pipelines, stages, tags },
    });
  }

  return {
    ok: true,
    proposal: {
      connected: true,
      warning: shape.ok ? null : shape.error,
      users: userRows,
      rows: decorate(input, { calendars, stages, pipelines, tags }),
    },
  };
}

function decorate(
  input: {
    outcomes: Array<{ name: string }>;
    suggestions: { calendars?: string[]; stage?: string | null; tag?: string | null };
    tracksResults: boolean;
    tracksSpeed: boolean;
    tracksReactivation: boolean;
  },
  pools: Record<MappingRow['pool'], Named[]>,
): ProposalRow[] {
  return mappingRows({
    outcomes: input.outcomes,
    calendars: input.suggestions.calendars ?? [],
    stage: input.suggestions.stage ?? null,
    tag: input.suggestions.tag ?? null,
    tracksResults: input.tracksResults,
    tracksSpeed: input.tracksSpeed,
    tracksReactivation: input.tracksReactivation,
  }).map((row) => {
    const options = rankNames(row.suggestedName, pools[row.pool] ?? []);
    return { ...row, options, suggestedId: bestMatch(row.suggestedName, options)?.id ?? null };
  });
}
