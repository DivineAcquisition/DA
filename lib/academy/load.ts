import { cache } from 'react';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { parseAcademyShell, type RawAcademyShell } from './parse';
import type { AcademyShell } from './types';

export const loadAcademyShell = cache(
  async (): Promise<{ ok: true; shell: AcademyShell } | { ok: false; message: string }> => {
    const supabase = await createClient();
    await controlRpc(supabase, 'academy_prepare');
    const { data, error } = await controlRpc<RawAcademyShell>(supabase, 'academy_shell');
    if (error) return { ok: false, message: readable(error) };
    const shell = parseAcademyShell(data);
    if (!shell) return { ok: false, message: 'The Academy could not be loaded.' };
    return { ok: true, shell };
  },
);
