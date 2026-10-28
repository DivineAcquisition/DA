import { NextResponse } from 'next/server';
import { academyAdminSession } from '@/lib/academy/access';
import { blankSimulationManifest } from '@/lib/academy/practiceImport';

export async function GET() {
  const session = await academyAdminSession();
  if (!session) return new NextResponse('Academy admin access is required.', { status: 403 });
  return new NextResponse(blankSimulationManifest(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="academy-simulations.csv"',
    },
  });
}
