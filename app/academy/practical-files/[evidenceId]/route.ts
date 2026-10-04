import { practicalFileResponse } from '@/lib/academy/practicalFile';

export async function GET(_request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await context.params;
  return practicalFileResponse(evidenceId);
}
