import { createClient } from '@supabase/supabase-js';
import { videoContentType } from '@/lib/academy/video';

function uploadMessage(message: string): string {
  if (/maximum|too large|entity too large|payload/i.test(message)) {
    return 'That video is larger than storage allows. Use a Vimeo or Mux link for a big file.';
  }
  return 'The video did not upload. Try again, or use a Vimeo or Mux link.';
}

/** Send the file straight to private storage with a one-time upload token. */
export async function uploadLessonVideo(file: File, path: string, token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return { ok: false, error: 'Storage is not configured.' };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const uploaded = await client.storage.from('academy-documents').uploadToSignedUrl(path, token, file, {
    contentType: file.type && file.type.startsWith('video/') ? file.type : videoContentType(file.name),
  });
  if (uploaded.error) return { ok: false, error: uploadMessage(uploaded.error.message) };
  return { ok: true };
}
